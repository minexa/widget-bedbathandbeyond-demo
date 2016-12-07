// https://github.com/jrburke/r.js/blob/master/build/example.build.js
requirejs.config({
    baseUrl: './',
    paths: {
        "jquery-private": './src/js/jquery-loader',
        'jquery-pubsub': './src/js/jquery.pubsub-loader',
        underscore: './vendor/underscore.min',
        slick: './vendor/slick.min',
        iscroll: './vendor/iscroll',
        tmpl: './templates/client',
        dist: './dist'
    },
    name: 'vendor/almond',
    optimize: 'none',
    include: ['src/js/index'],
    insertRequire: ['src/js/index'],
    out: './dist/js-lib.tmpl'
})
