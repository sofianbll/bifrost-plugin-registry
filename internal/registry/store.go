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
	next, _, err := s.save(data, expected, false)
	return next, err
}

// SaveWithBackup saves a validated import and writes a private copy of the
// previous on-disk config before replacing it, under the same revision lock.
func (s *Store) SaveWithBackup(data []byte, expected string) (*Snapshot, string, error) {
	return s.save(data, expected, true)
}

func (s *Store) save(data []byte, expected string, backup bool) (*Snapshot, string, error) {
	candidate, err := Parse(data)
	if err != nil {
		return nil, "", err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if expected == "" || s.Load().Revision() != expected {
		return nil, "", ErrConflict
	}
	var backupPath string
	if s.path != "" {
		// Do not overwrite edits made by another process while this server was running.
		onDisk, err := os.ReadFile(s.path)
		if err != nil {
			return nil, "", err
		}
		disk, err := Parse(onDisk)
		if err != nil || disk.Revision() != expected {
			return nil, "", ErrConflict
		}
		if candidate.Revision() == expected {
			return s.Load(), "", nil
		}
		if backup {
			backupPath, err = writeBackup(s.path, onDisk)
			if err != nil {
				return nil, "", err
			}
		}
		if err := AtomicWrite(s.path, append(candidate.JSON(), '\n')); err != nil {
			return nil, backupPath, err
		}
	} else if candidate.Revision() == expected {
		return s.Load(), "", nil
	}
	s.current.Store(candidate)
	return candidate, backupPath, nil
}

func writeBackup(path string, data []byte) (string, error) {
	f, err := os.CreateTemp(filepath.Dir(path), "."+filepath.Base(path)+".backup-*")
	if err != nil {
		return "", err
	}
	name := f.Name()
	if err = f.Chmod(0600); err == nil {
		_, err = f.Write(data)
	}
	if err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err == nil {
		err = closeErr
	}
	if err != nil {
		_ = os.Remove(name)
		return "", err
	}
	if dir, err := os.Open(filepath.Dir(path)); err == nil {
		_ = dir.Sync()
		_ = dir.Close()
	}
	return name, nil
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
