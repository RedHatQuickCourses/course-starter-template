REPONAME=$(basename `git rev-parse --show-toplevel`)
echo -ne "Initializing $REPONAME . . . "
sed -i "s/REPLACEREPONAME/${REPONAME}/g" *.* > /dev/null 2>&1
##TODO: Any automation required for repo customization (like for example HOL vs BFX) goes here.
echo -e "done"
rm -f $0
