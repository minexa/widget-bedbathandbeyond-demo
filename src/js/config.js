define(function(require) {

    // Add globals with data from the backend.
    window._tvp = window._tvp || {};
    _tvp.assetsBaseUrl = true ? "{{TVP_CDN_TVSITE}}".replace('//', '').split('/').shift() : 'app.tvpage.com/tvsite/' + domain;;
    _tvp.lid = '{{loginId}}';

     //Aquire ID from URL
    var arr = window.location.href.split("/");
    arr.pop();
    var urlId = arr.pop();
    var isnum = /^\d+$/.test(urlId);
    var settings = JSON.parse("{{tvsite_cartridge_idstring('settings')}}");
    
     _tvp.channelId = settings["default-channel"];
    
    if(isnum){
         _tvp.channelId = settings[urlId];
    }

    _tvp.chgEndpoint = "//app.tvpage.com/tvsite/{{domain}}/cartridge/" + settings["videos-slider-1"];
    _tvp.analyticsEndpoint = "//app.tvpage.com/tvsite/{{domain}}/cartridge/" + settings["analytics-1"];
    _tvp.relatedProductsDesktop = "//app.tvpage.com/tvsite/{{domain}}/cartridge/" + settings["related-products-desktop"];
});
