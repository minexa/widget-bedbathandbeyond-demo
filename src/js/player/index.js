define(function(require) {

    var $ = require('jquery-private');

    require('../jquery.pubsub-loader');    

    var iOSsmall = /iPhone|iPod/i.test(navigator.userAgent),
        mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
        $el = null,
        options = null,
        assetsList = null,
        playerReady = null,
        player = null,
        index = null,
        multiple = true,
        keys = null;

    function resize() {
        if (player && $el.length) {
            player.resize($el.width(), $el.height());
        }
    }

    function putButtonOverlay() {
        $('<div/>').attr('id', 'tvpp-play').insertAfter('#tvpp-holder').on('click', function() {
            $el.find('.video-overlay').hide();
            $(this).off().remove();
            return player ? player.play() : false;
        });
    }

    function play(asset) {
        if (asset) {
            if (asset.type === 'mp4' && iOSsmall) {
                $el.addClass('tvp-controls-mp4');
                $el.find('#ControlBarFloater').parent().addClass('tvp-hide-mp4');
            } else {
                $el.removeClass('tvp-controls-mp4');
                $el.find('#ControlBarFloater').parent().removeClass('tvp-hide-mp4');
            }
            var ready = function() {
                if (mobile) {
                    player.cueVideo(asset);
                    if (!iOSsmall && asset.type == 'mp4') putButtonOverlay();
                } else {
                    player.loadVideo(asset);
                }
            };
            if (!playerReady) {
                var check = setInterval(function() {
                    if (playerReady) {
                        ready();
                        clearInterval(check);
                    }
                }, 100);
            } else {
                ready();
            }
        }
    }

    function extractAsset(video) {
        if (video && video.asset) {
            var asset = video.asset;
            asset.analyticsObj = { vd: video.id, li: video.loginId, pg: video.parentId ? video.parentId : 0 };
            if (!asset.sources) asset.sources = [{ file: asset.videoId }];
            asset.type = asset.type || 'youtube';
            return asset;
        }
    }

    function handleEnded() {
        if (multiple) {
            index = (index == assetsList.length - 1) ? 0 : index + 1;
            if (mobile) {
                player.cueVideo(asset);
                if (!iOSsmall && assetsList[index].type == 'mp4') putButtonOverlay();
            } else {
                player.loadVideo(extractAsset(assetsList[index]));
            }
            $.publish('player:play-video', assetsList[index]);
        }
    }

    return {
        init: function(opts, callback) {

            options = opts || {};

            var html = require('text!tmpl/player.html');
            $el = $(html).appendTo(opts.place);

            var settings = require('./settings');
            settings.onReady = function() { playerReady = true; };

            var ready = function(p) {
                player = TVPage.instances[p.options.globalRunId];
                player.on('tvp:media:videoended', handleEnded);
                resize();
            };

            if (!window.TVPage) {
                $.ajax({ dataType: 'script', cache: true, url: settings.jsLib })
                    .done(function() {
                        if (window.TVPage) {
                            ready(new TVPage.player(settings));
                        }
                    });
            } else {
                ready(new TVPage.player(settings));
            }

            $.subscribe('products:loaded', function(e, products) {
                products.length ? $el.removeClass('no-products') : $el.addClass('no-products');
                resize();
            });

            $.subscribe('light-box:hiding', function() {
                $el.removeClass('no-products');
                $el.find('#tvpp-play').remove();
                player.stop();
            });

            $.subscribe('player:play', function(e, n, video) {
                resize();
                $el.find('.video-overlay').hide();
                index = parseInt(n);
                assetsList = _tvp.channel.videos;
                multiple = true;

                var video = assetsList[index];
                if (video) {
                    play(extractAsset(video));
                    $.publish('player:play-video', video);
                }

            });

            $(window).resize(resize);

            if ($.isFunction(callback)) {
                callback();
            }
        }
    };

});
