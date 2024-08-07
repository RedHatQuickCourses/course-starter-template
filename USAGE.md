## Guideline for editing your content

- Browse in to the `modules` directory and edit `adoc` files under `pages` directory to add for your content.

### Add new section in existing chapter

- To create an additional section page, create an `adoc` file for your section page, in the chapter director.
- Add new `xref` line for information about this new section page in `nav.adoc` file under the same chapter directory.

### Add new chapter 

- For additional chapter, create a copy of an existing chapter directory. 
- Change `index.adoc` file with the heading for the new chapter.

Note: You need to modify `antora.yml` file for the new chapter to reflect in your rendered content.

**SEE ALSO**

- [Getting started with a new training content repository](./README.md)
- [Development using devspace](./DEVSPACE.md)
