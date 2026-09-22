package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"bifrost-registry/internal/admin"
	"bifrost-registry/internal/registry"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "registry:", err)
		os.Exit(1)
	}
}
func run(args []string) error {
	if len(args) == 0 {
		return errors.New("usage: registry serve|validate|plan|hash|merge-aliases [options]")
	}
	if args[0] == "hash" {
		b, e := io.ReadAll(io.LimitReader(os.Stdin, 1025))
		if e != nil {
			return e
		}
		token := strings.TrimRight(string(b), "\r\n")
		if _, err := registry.Credential(map[string]string{"x-bf-vk": token}); err != nil {
			return errors.New("pipe a Bifrost virtual key on stdin; never put secrets in command arguments")
		}
		fmt.Println(registry.TokenHash(token))
		return nil
	}
	fs := flag.NewFlagSet(args[0], flag.ContinueOnError)
	config := fs.String("config", "configs/registry.json", "Registry file")
	listen := fs.String("listen", "127.0.0.1:8099", "Local administration address")
	host := fs.String("allow-host", "", "Additional permitted HTTP Host name")
	source := fs.String("bifrost-config", "", "Existing Bifrost config.json (read only)")
	output := fs.String("out", "", "New output file; existing files are never overwritten")
	if e := fs.Parse(args[1:]); e != nil {
		return e
	}
	store, e := registry.OpenStore(*config)
	if e != nil {
		return e
	}
	switch args[0] {
	case "validate":
		fmt.Printf("Valid registry · revision %s\n", store.Load().Revision())
		return nil
	case "plan":
		b, e := json.MarshalIndent(store.Load().Plan(), "", "  ")
		if e != nil {
			return e
		}
		return emit(b, *output)
	case "merge-aliases":
		if *source == "" || *output == "" {
			return errors.New("--bifrost-config and --out are required; the input file will not be modified")
		}
		b, e := os.ReadFile(*source)
		if e != nil {
			return e
		}
		out, e := store.Load().MergeAliases(b)
		if e != nil {
			return e
		}
		return emit(out, *output)
	case "serve":
		token := os.Getenv("REGISTRY_ADMIN_TOKEN")
		if token == "" {
			var b [32]byte
			if _, e := rand.Read(b[:]); e != nil {
				return e
			}
			token = hex.EncodeToString(b[:])
			fmt.Fprintln(os.Stderr, "Temporary local admin token:", token)
		}
		handler, e := admin.New(store, token, strings.Split(*host, ","))
		if e != nil {
			return e
		}
		server := handler.HTTPServer(*listen)
		ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
		defer stop()
		done := make(chan error, 1)
		go func() { done <- server.ListenAndServe() }()
		fmt.Fprintln(os.Stderr, "Registry administration: http://"+*listen+"/model-registry")
		fmt.Fprintln(os.Stderr, "Local control plane only. No request is sent to a provider; native Bifrost aliases are not automatically applied.")
		select {
		case e := <-done:
			if !errors.Is(e, http.ErrServerClosed) {
				return e
			}
			return nil
		case <-ctx.Done():
			shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			return server.Shutdown(shutdown)
		}
	default:
		return errors.New("unknown command")
	}
}
func emit(data []byte, path string) error {
	if path == "" {
		fmt.Println(string(data))
		return nil
	}
	f, e := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if e != nil {
		return e
	}
	_, e = f.Write(append(data, '\n'))
	ce := f.Close()
	if e != nil {
		return e
	}
	return ce
}
