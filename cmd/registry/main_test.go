package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestEmitRefusesOverwrite(t *testing.T) {
	p := filepath.Join(t.TempDir(), "config.json")
	if e := emit([]byte(`{"original":1}`), p); e != nil {
		t.Fatal(e)
	}
	if e := emit([]byte(`{"overwrite":1}`), p); e == nil {
		t.Fatal("overwrote existing file")
	}
	b, _ := os.ReadFile(p)
	if string(b) != "{\"original\":1}\n" {
		t.Fatal(string(b))
	}
	info, _ := os.Stat(p)
	if info.Mode().Perm() != 0600 {
		t.Fatal("output not private")
	}
}
func TestCLIValidationAndPlan(t *testing.T) {
	p := filepath.Join(t.TempDir(), "registry.json")
	os.WriteFile(p, []byte(`{"schema_version":1,"default_naming":"model","models":[],"groups":[],"policies":[]}`), 0600)
	if e := run([]string{"validate", "--config", p}); e != nil {
		t.Fatal(e)
	}
	out := filepath.Join(t.TempDir(), "plan.json")
	if e := run([]string{"plan", "--config", p, "--out", out}); e != nil {
		t.Fatal(e)
	}
	if e := run([]string{"plan", "--config", p, "--out", out}); e == nil {
		t.Fatal("replaced plan")
	}
	if e := run([]string{"merge-aliases", "--config", p}); e == nil {
		t.Fatal("missing merge args accepted")
	}
	if e := run([]string{"unknown", "--config", p}); e == nil {
		t.Fatal("unknown command")
	}
	if e := run(nil); e == nil {
		t.Fatal("empty command")
	}
}
