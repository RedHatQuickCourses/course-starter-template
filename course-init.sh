#!/usr/bin/env bash
# Initialize a course repo created from course-starter-template.
# Usage: ./course-init.sh --type hol|bfx --lab demo|role|other

set -euo pipefail

print_usage() {
	cat <<'EOF'
USAGE: ./course-init.sh --type [hol|bfx] --lab [demo|role|other]

  --type hol   Hands-on / standard Quick Course module layout (default tree)
  --type bfx   Break-fix layout (requires modules.bfx/ in the template; not always present)
  --lab demo|role|other   Selects modules/LABENV/pages/index-lab-<lab>.adoc as the lab landing page

Example (macOS): zsh course-init.sh --type hol --lab demo
EOF
}

exit_script() {
	echo
	echo "Please replace FIXME / course title placeholders in antora.yml (and related files), then commit before development."
	grep -n 'FIXME\|REPLACEREPONAME\|REPLACE Course Title' antora.yml antora-playbook.yml 2>/dev/null || true
}

handle_lab() {
	local src="modules/LABENV/pages/index-lab-${LAB}.adoc"
	if [[ ! -f "$src" ]]; then
		echo "ERROR: Lab template not found: $src"
		exit 1
	fi
	cp -f "$src" modules/LABENV/pages/index.adoc
}

handle_type() {
	case "$TYPE" in
		hol)
			rm -rf modules.bfx
			;;
		bfx)
			if [[ ! -d modules.bfx ]]; then
				echo "ERROR: --type bfx requires modules.bfx/ in this template, but it is missing."
				echo "Use --type hol, or restore break-fix module content into modules.bfx/ first."
				exit 1
			fi
			rm -rf modules
			mv modules.bfx modules
			;;
		*)
			echo "ERROR: Invalid type: $TYPE"
			print_usage
			exit 1
			;;
	esac
}

replace_placeholders() {
	local reponame="$1"
	# Portable in-place replace for macOS and Linux
	local files
	files=$(grep -rl 'REPLACEREPONAME' . \
		--exclude-dir=.git \
		--exclude-dir=node_modules \
		--exclude-dir=ui-bundle \
		--exclude-dir=build \
		2>/dev/null || true)
	if [[ -n "$files" ]]; then
		while IFS= read -r f; do
			[[ -z "$f" ]] && continue
			sed -i.bak "s/REPLACEREPONAME/${reponame}/g" "$f"
			rm -f "${f}.bak"
		done <<<"$files"
	fi
}

execute_init() {
	handle_type
	handle_lab
	local reponame
	reponame=$(basename "$(git rev-parse --show-toplevel)")
	echo -ne "Initializing ${reponame} . . . "
	replace_placeholders "$reponame"
	if [[ -f README-TRAINING.md ]]; then
		mv -f README-TRAINING.md README.md
	fi
	# Remove unused lab variants after selection
	rm -f modules/LABENV/pages/index-lab-*.adoc
	echo "done"
	# Self-remove so learner repos do not keep the template init script
	rm -f "$0"
}

LAB=""
TYPE=""

if [[ $# -lt 4 ]]; then
	echo "ERROR: Insufficient arguments"
	print_usage
	exit 1
fi

while [[ $# -gt 0 ]]; do
	case "$1" in
		--lab)
			LAB="${2:-}"
			shift 2
			;;
		--type)
			TYPE="${2:-}"
			shift 2
			;;
		--help|-h)
			print_usage
			exit 0
			;;
		*)
			echo "ERROR: Unknown argument: $1"
			print_usage
			exit 1
			;;
	esac
done

case "$LAB" in
	demo|role|other) ;;
	*)
		echo "ERROR: Invalid lab type: $LAB"
		print_usage
		exit 1
		;;
esac

case "$TYPE" in
	hol|bfx) ;;
	*)
		echo "ERROR: Invalid course type: $TYPE"
		print_usage
		exit 1
		;;
esac

execute_init
echo "Initialized type to $TYPE and lab to $LAB"
exit_script
