YUI.add('child-yui-module', function (Y, NAME) {
    'use strict';
    Y.one(".log").append("<div>YUI: child-yui-module added</div>");
}, '0.0.1', {requires: []});