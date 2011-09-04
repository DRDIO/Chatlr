(function($) {
    var methods = {
        init: function(options) {
            // Nothing to do yet
        },
        
        strobe: function() {
            return this.each(function() {
                $(this).fadeTo(500, 0.5).fadeTo(500, 1.0, function() {
                    $(this).tumblrchat('strobe');
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
    // Dynamic calling of methods out of tumblrchat objects
    
    $.fn.tumblrchat = function(method) {       
        // Method calling logic
        if (methods[method]) {
            return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return methods.init.apply(this, arguments);
        } else {
            $.error('Method ' + method + ' does not exist on jQuery.');
        }
    }
})(jQuery);