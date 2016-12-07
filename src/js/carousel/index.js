define(function(require) {

    var $ = require('jquery-private');

    require('slick');

    var $el = $('#tvp-gallery');
    var settings = require('./settings');

    var move = function(dir){
        $('#tvpchg-slider').slick('slick' + ( dir || "" ).charAt(0).toUpperCase() );
    };

    $(document).on('click', '.tvp-arrow-prev', function(e) {
        move("prev");
    }).on('click', '.tvp-arrow-prev',function(e) {
         move("next")
    });

    $.ajaxSetup({
        headers: {
            'X-Login-Id': ("undefined" !== typeof _tvp.lid ? _tvp.lid : 0)
        }
    });
    
    $.ajax({
        url: _tvp.chgEndpoint,
        type: 'post',
        dataType: 'json',
        data: JSON.stringify({
            includeData: true,
            channelId: _tvp.channelId
        })
    }).done(function(res) {
        
        $el.append(res && "undefined" !== typeof res.html ? res.html : '').promise().done(function() {
            $el.find('#tvpchg-slider').slick(settings);
        });

    });

});
