define({
    divId: 'tvpp-holder',
    controls: {
        active: false,
        seekBar: { progressColor: '#273691' },
        floater: { removeControls: [], transcript: false }
    },
    poster: true,
    techOrder: 'html5,flash',
    analytics: { tvpa: false },
    apiBaseUrl: '//app.tvpage.com',
    jsLib: '//d2kmhr1caomykv.cloudfront.net/player/assets/tvp/tvp-1.8.3-min.js',
    swf: "//d2kmhr1caomykv.cloudfront.net/player/assets/tvp/tvp-1.8.3-flash.swf"
});
