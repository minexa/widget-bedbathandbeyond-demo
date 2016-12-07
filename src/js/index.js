define(function(require) {

    var $ = require('jquery-private');
    var css = require('text!dist/css-lib.tmpl');

    if (!$('#tvp-css-lib').length) {
        $('<style/>').attr('id', "tvp-css-lib").html(css).appendTo('head');
    }

    require('./jquery.pubsub-loader');

    $(function() {

        require('./config');
        require('./carousel/index');

        var lightBox = require('./light-box/index');
        var player = require('./player/index');

        lightBox.init(function() {

            var options = {
                place: '#tvplb .lb-body'
            };

            player.init(options, function() {

                $(document).on('click', '.tvp-video', function(e) {

                    e.preventDefault();
                    e.stopPropagation();

                    var index = $(e.currentTarget).attr('data-index');
                    if (null !== typeof index && 'undefined' !== typeof index) {
                        $.publish('light-box:show');
                        $.publish('player:play', index);
                    }

                });

                $("#tvp-gallery").addClass("enabled");

            });

            var products = require('./products/index');
            products.init(options);

        });

    });

});
