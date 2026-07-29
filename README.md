## Getting started with a new training content repository

This is the **Quick Course** starter template used by Content Architects and the **Open Training** program (Know-It / How-To / Break-Fix style content built with Antora + AsciiDoc).

### 1. Create your repo

1. Open [course-starter-template](https://github.com/RedHatQuickCourses/course-starter-template)
2. Click **Use this template** → **Create a new repository**
3. Create the repo under the RedHatQuickCourses org (or your allowed namespace)

### 2. Clone and initialize

```bash
git clone git@github.com:RedHatQuickCourses/my-training-repository.git
cd my-training-repository/
```

Initialize the course (macOS: prefer `zsh`):

```bash
zsh course-init.sh --type hol --lab demo
```

| Flag | Values | Meaning |
| --- | --- | --- |
| `--type` | `hol` | Standard / hands-on Quick Course module tree (recommended default) |
| `--type` | `bfx` | Break-fix layout — only if `modules.bfx/` exists in the template |
| `--lab` | `demo` / `role` / `other` | Selects the LABENV landing page variant |

The script replaces `REPLACEREPONAME` with your repository name, sets the lab index page, swaps in `README-TRAINING.md` as `README.md`, and removes itself.

Then set the course title in `antora.yml` (replace `FIXME Course Title`) and commit:

```bash
git add -A
git commit -m "course initialization"
git push origin main
```

### 3. Enable GitHub Pages

On the repo **About** / Pages settings, enable GitHub Pages for the site published by Actions (or follow your org’s Pages process). After the first successful publish workflow, use the Pages URL to review rendered content.

PR builds also publish previews via the PR preview workflow.

### 4. Author content

* Edit AsciiDoc under `modules/`
* Syntax and media duration guidance: [USAGEGUIDE.adoc](./USAGEGUIDE.adoc)
* Local preview: `npm ci && npm run build && npm run serve`
* Optional Dev Spaces workflow: [DEVSPACE.md](./DEVSPACE.md)

### Audience notes

* **Content Architects (internal PERT builds):** use this template for Antora Quick Courses destined for LMS packaging/SCORM when needed.
* **Open Training SMEs:** same template; submit ideas via the Open Training intake form and get support in `#help-open-training`.

### See also

* [USAGEGUIDE.adoc](./USAGEGUIDE.adoc) — AsciiDoc / Antora authoring reference
* [DEVSPACE.md](./DEVSPACE.md) — develop in OpenShift Dev Spaces
* PERT Confluence: Quick Courses and GitHub hub (team docs)
