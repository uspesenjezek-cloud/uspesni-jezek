#!/usr/bin/env python3
"""Sproti prenaša Claudove spremembe z GitHuba na lokalno stran WerkTech.

Vir:  veja claude/happy-maxwell-n3dkxx, mapa docs/prenos/werktech-local/
Cilj: app/spletna-stran/ (stran na http://localhost:8001/app/spletna-stran/)

Zagon v korenu lokalnega repozitorija:
    python3 tools/werktech-sync.py

Skripta ne spreminja trenutne veje ali delovnega drevesa; samo `git fetch`
in zapis datotek v ciljno mapo. Datoteke, ki so bile lokalno spremenjene po
zadnjem prenosu, NE prepiše: izpiše jih kot konflikt in jih pusti pri miru.
Stran z ?_dev= se po prenosu sama osveži (app/pwa-dev-refresh.js).
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
import time

BRANCH = "claude/happy-maxwell-n3dkxx"
SOURCE = "docs/prenos/werktech-local"
SKIP = {"README.md"}


def git(root, *args):
    return subprocess.run(["git", "-C", root, *args], check=True, capture_output=True).stdout


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read(path):
    try:
        with open(path, "rb") as f:
            return f.read()
    except FileNotFoundError:
        return None


def log(msg):
    print(time.strftime("%H:%M:%S"), msg, flush=True)


def sync_once(root, target, state, first):
    ref = "origin/" + BRANCH
    try:
        git(root, "fetch", "--quiet", "origin", BRANCH)
    except subprocess.CalledProcessError as e:
        log("git fetch ni uspel: " + e.stderr.decode(errors="replace").strip())
        return
    commit = git(root, "rev-parse", "--short", ref).decode().strip()
    if not first and state.get("commit") == commit:
        return
    names = git(root, "ls-tree", "-r", "--name-only", ref, SOURCE + "/").decode().splitlines()
    files = state.setdefault("files", {})
    changed, conflicts, local_only = [], [], []
    for name in names:
        rel = name[len(SOURCE) + 1:]
        if rel in SKIP:
            continue
        remote = git(root, "show", ref + ":" + name)
        dest = os.path.join(target, rel)
        local = read(dest)
        r, l, last = sha(remote), sha(local) if local is not None else None, files.get(rel)
        if l == r:
            files[rel] = r
        elif local is None or l == last:
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest + ".sync-tmp", "wb") as f:
                f.write(remote)
            os.replace(dest + ".sync-tmp", dest)
            files[rel] = r
            changed.append(rel)
        elif last != r:
            conflicts.append(rel)
        else:
            local_only.append(rel)
    state["commit"] = commit
    if changed:
        log("prenos %s: %s" % (commit, ", ".join(changed)))
    elif first:
        log("stanje %s: brez sprememb za prenos" % commit)
    for rel in local_only:
        log("lokalna sprememba %s še ni na GitHubu (Claude je ne vidi)" % rel)
    for rel in conflicts:
        log("KONFLIKT %s: lokalno spremenjeno, ni prepisano (pushaj lokalno različico ali jo zbriši)" % rel)


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--target", default="app/spletna-stran", help="ciljna mapa glede na koren repozitorija")
    p.add_argument("--interval", type=float, default=5, help="sekunde med preverjanji")
    p.add_argument("--once", action="store_true", help="en prenos in konec")
    args = p.parse_args()

    root = git(os.getcwd(), "rev-parse", "--show-toplevel").decode().strip()
    target = os.path.join(root, args.target)
    if not os.path.isdir(target):
        sys.exit("Ciljna mapa ne obstaja: " + target)
    state_path = os.path.join(target, ".werktech-sync.json")
    state = json.loads(read(state_path) or b"{}")

    log("vir %s:%s -> %s" % (BRANCH, SOURCE, target))
    first = True
    while True:
        sync_once(root, target, state, first)
        with open(state_path, "w") as f:
            json.dump(state, f, indent=1)
        first = False
        if args.once:
            break
        time.sleep(args.interval)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
