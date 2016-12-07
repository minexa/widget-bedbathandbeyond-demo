define(function(require) {
    
    var _ = require("underscore");
    var $ = require("jquery-private");
    
    require('../jquery.pubsub-loader');
    
    var $el = null;

    function show(){
        $el.find('.lb-overlay').show();
        $el.removeClass('off');
    }

    function hide(){
        $el.find('.lb-overlay').hide();
        $el.addClass('off');
        $.publish('light-box:hiding');
    }

    function changeTitle(e,video){
        if(_tvp.channel && video){
            $el.find('.lb-title').html(video.title);
            var link = "https://www.newegg.tv/"
            $el.find('#watch_more_link').attr('href',link);
            $el.find('#watch_more_link_mobile').attr('href',link);  
        }
    }

    return {
        init: function(callback){

            $(function(){
                
                $el = $('<div/>').attr('id','tvplb').addClass('off');
                var html = require('../../../text!tmpl/light-box.html');  
                $el.append(_.template(html)({logo: _tvp.assetsBaseUrl +'/script-lbp/assets/logo.png'}));
                $el.appendTo('body');

                $el.on('click', '.lb-close', hide);
                $el.on('click', '.lb-overlay', hide);

                $.subscribe('light-box:show', show);
                $.subscribe('player:play-video',changeTitle);
                
                if (_.isFunction(callback)) {
                    callback();
                }

            });

        }
    };

});