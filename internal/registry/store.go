package registry

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
)

var ErrConflict = errors.New("registry revision changed; reload before saving")

type Store struct {
	path    string
	current atomic.Pointer[Snapshot]
	mu      sync.Mutex
}

func OpenStore(path string) (*Store, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	s, err := Parse(b)
	if err != nil {
		return nil, err
	}
	st := &Store{path: path}
	st.current.Store(s)
	return st, nil
}
func MemoryStore(s *Snapshot) *Store { st := &Store{}; st.current.Store(s); return st }
func (s *Store) Load() *Snapshot     { return s.current.Load() }
func (s *Store) Save(data []byte, expected string) (*Snapshot, error) {
	candidate, err := Parse(data)
	if err != nil {
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if expected == "" || s.Load().Revision() != expected {
		return nil, ErrConflict
	}
	if s.path != "" {
		// Do not overwrite edits made by another process while this server was running.
		onDisk, err := os.ReadFile(s.path)
		if err != nil {
			return nil, err
		}
		disk, err := Parse(onDisk)
		if err != nil || disk.Revision() != expected {
			return nil, ErrConflict
		}
		if err := AtomicWrite(s.path, append(candidate.JSON(), '\n')); err != nil {
			return nil, err
		}
	}
	s.current.Store(candidate)
	return candidate, nil
}
func AtomicWrite(path string, data []byte) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}
	f, err := os.CreateTemp(dir, ".registry-*.tmp")
	if err != nil {
		return err
	}
	name := f.Name()
	defer os.Remove(name)
	if err = f.Chmod(0600); err == nil {
		_, err = f.Write(data)
	}
	if err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	if err = os.Rename(name, path); err != nil {
		return fmt.Errorf("atomic replace: %w", err)
	}
	// Best effort directory sync: some platforms/filesystems don't support it.
	if d, e := os.Open(dir); e == nil {
		_ = d.Sync()
		_ = d.Close()
	}
	return nil
}
