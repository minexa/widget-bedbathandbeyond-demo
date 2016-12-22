module.exports = function(grunt) {

    grunt.initConfig({
        requirejs: {
            compile: {
                options: {
                    mainConfigFile: 'build.js'
                }
            }
        },
        autoprefixer: {
            css: {
                files: {
                    'static/js-css.css':'static/js-css.css'
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-requirejs');
    grunt.loadNpmTasks('grunt-autoprefixer');
    
    grunt.registerTask('dev', ['autoprefixer','requirejs']);

};
