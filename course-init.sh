## Get the training repository name and replace it with the placeholder string in different files
REPONAME=$(basename `git rev-parse --show-toplevel`)
echo -ne "Initializing $REPONAME . . . "
sed -i "s/REPLACEREPONAME/${REPONAME}/g" *.* > /dev/null 2>&1
sed -i "s/REPLACEREPONAME/${REPONAME}/g" supplemental-ui/partials/header-content.hbs > /dev/null 2>&1
echo -e "done"

mv -f README-TRAINING.md README.md

## Automation required for repo customization (like for example TYPE hol or bfx LAB demo or role or other) goes here.
print_usage()
{
	echo -e """
	USAGE: $0 --type [hol|bfx] --lab [demo|role|other]
	DEFAULT: $0 --type hol --lab demo
	"""
	return
}
handle_lab()
{
	case "$1" in 
		"demo"|"role"|"other" )
			LAB=$(echo $1)
			;;
		* )
			print_usage
			exit 1
			;;
	esac
}
handle_type()
{
        case "$1" in 
                "hol"|"bfx" )
                        TYPE=$(echo $1)
                        ;;
                * )
                        print_usage
                        exit 1
                        ;;
        esac
}
execute_init()
{
	echo -e "Initializing type to $TYPE and lab to $LAB "
	mv -f modules/LABENV/pages/index-lab-$LAB.adoc modules/LABENV/pages/index.adoc
	echo -e "TODO: Handling course type is not implemented yet"
	exit 0
}
for arg in "$@" 
do
	case ${arg} in 
		"--lab" ) 
			shift
			handle_lab $1
			shift
			;;
		"--type" ) 
			shift
			handle_type $1
			shift
			;;
		"--help" )
			print_usage
			exit 0
			;;
	esac
done
execute_init

#cleanup()
echo -e "\nPlease replace the specified strings in the files below and commit the changes before proceeding with the course development."
grep FIXME *.*

cleanup()
{
	# Clean unused files for lab type
	rm -f modules/LABENV/pages/index-*.adoc
	# Clean unused files for course type
	# Remove this script
	rm -f $0
}
