(function($) {
    var methods = {
        init: function(options) {
            // Nothing to do yet
        },
        
        scroll: function(scroll) {            
            return this.each(function() {
                var self        = $(this),
                    viewport    = self.find('.viewport');

                // Make sure this scrollbox has a valid viewport
                if (viewport.length) {
                    var scrollbar    = self.find('.scrollbar'),
                        scrollclick  = null,
                        scrollheight = 0;
                    
                    if (!scrollbar.length) {
                        // Create the scroll box if it hasn't been created
                        scrollclick = $('<div />', {
                            'class': 'scrollclick'
                        });

                        scrollbar = $('<div />', {
                            'class': 'scrollbar',
                            css: {
                                position: 'absolute'
                            }
                        }).append(scrollclick);

                        self.append(scrollbar);
                        
                        self.mouseenter(function(e) {
                            $('body').data('hoverbox', self.attr('id'));
                            
                            if (!$('body').data('scrolling')) {
                                $(this).find('.scrollbar').fadeIn(250);
                            }
                        });

                        self.mouseleave(function(e) {
                            $('body').data('hoverbox', null);
                            
                            if (!$('body').data('scrolling')) {
                                $(this).find('.scrollbar').fadeOut(250);
                            }
                        });

                        scrollclick.mousedown(function(e) {
                            $('body')
                                .data('scrolling', {
                                    box:   this,
                                    y:     e.pageY,
                                    start: parseInt($(this).css('margin-top'))
                                })
                                .disableSelection();
                        });
                        
                    } else {
                        // Else get existing scrollbox
                        scrollclick = scrollbar.find('.scrollclick');
                    }
                     
                    var hideAgain = false;
                    if (scrollbar.is(':hidden')) {
                        hideAgain = true;
                        scrollbar.show();
                    } 
                    
                    scrollbar
                        .outerHeight(self.innerHeight(), true)
                        .position({my: 'right top', at: 'right top', of: self});

                    scrollheight = Math.max(24, scrollbar.height() * Math.min(1, scrollbar.outerHeight() / viewport[0].scrollHeight));
                    
                    scrollclick
                        .outerHeight(scrollheight)
                        .data('maxY', scrollbar.height() - scrollheight);
                        
                    if (hideAgain) {
                        scrollbar.hide();
                    }
                    
                    if (scroll) {
                        self.scrollTop(scroll);
                    }
                }
            });    
        },
        
        strobe: function() {
            return this.each(function() {
                $(this).fadeTo(500, 0.5).fadeTo(500, 1.0, function() {
                    $(this).chatlr('strobe');
                });
            });
        },

        stopstrobe: function() {
            return this.each(function() {
                $(this).stop(true).fadeTo(5000, 0.1);
            });
        },

        sortusers: (function() {
            var sort = [].sort;

            return function(comparator, getSortable) {
                getSortable = getSortable || function() {
                    return this;
                };

                var placements = this.map(function() {
                    var sortElement = getSortable.call(this),
                        parentNode  = sortElement.parentNode,
                        nextSibling = parentNode.insertBefore(
                            document.createTextNode(''),
                            sortElement.nextSibling
                        );

                    return function() {
                        if (parentNode === this) {
                            $.error('Cannot sort descendents of self');
                        }

                        parentNode.insertBefore(this, nextSibling);
                        parentNode.removeChild(nextSibling);

                    };

                });

                return sort.call(this, comparator).each(function(i) {
                    placements[i].call(getSortable.call(this));
                });
            };
        })()
    };

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // Dynamic calling of methods out of chatlr objects
    
    $.fn.chatlr = function(method) {       
        // Method calling logic
        if (methods[method]) {
            return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return methods.init.apply(this, arguments);
        } else {
            $.error('Method ' + method + ' does not exist on jQuery.');
        }
    }
    
    $(function() {
        $('body').mousemove(function(e) {
            var scrolling = $('body').data('scrolling');
            if (scrolling) {                
                var scrollClick = $(scrolling.box),
                    scrollBar = scrollClick.parent(),
                    viewport  = scrollBar.siblings('.viewport'),
                    offsetY = scrolling.start + e.pageY - scrolling.y,
                    moveY   = Math.min(scrollClick.data('maxY'), Math.max(0, offsetY)),
                    viewY   = -viewport.height() * moveY / scrollBar.height();

                scrollClick.css({'margin-top': moveY});

                scrollBar.parent().scrollTop(-viewY);
            }
        });

        $('body').mouseup(function(e) {
            $('body')
                .data('scrolling', null)
                .enableSelection();
        });
    });
})(jQuery);