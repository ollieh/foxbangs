const { Cc, Ci, Cr, Cu } = require("chrome");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
var events = require("sdk/system/events");
var windowUtils = require("sdk/window/utils");
const windows = require("sdk/windows");
const self = require("sdk/self");

bangs = {
};

var bangsLines = self.data.load("bangs.csv").split("\n");
for each (let l in bangsLines) {
    var bAndUrl = l.split("\t");
    if (bAndUrl.length == 2) {
        var b = bAndUrl[0];
        var url = bAndUrl[1];
        bangs[b] = url;
    }
}

function removeTrailingPlus(str) {
    if (str.slice(-1) == "+") {
        return str.slice(0,str.length-1);
    } else {
        return str
    }
}
var myExtension = {
    oldURL: null,

    init: function(w) {
        w.getBrowser().addProgressListener(this);
    },

    uninit: function(w) {
        w.getBrowser.removeProgressListener(this);
    },

    // nsIWebProgressListener
    QueryInterface: XPCOMUtils.generateQI(["nsIWebProgressListener",
                                           "nsISupportsWeakReference"]),

    onLocationChange: function(aProgress, aRequest, aURI) {
        if (aURI.spec == this.oldURL) return;

        // now we know the url is new...
        var url = aURI.spec;
        var query_reg = /\?q=([a-zA-Z0-9%+!]*)/;
        var query_match = url.match(query_reg);
        var query = query_match ? query_match[1] : null;
        var bang_reg = /(![a-zA-Z0-9]*)/;
        var bang_match = query.match(bang_reg);
        var bang = bang_match ? bang_match[1] : null;
        if (bang && bangs[bang]) {
            var new_query = removeTrailingPlus(query.replace(bang,"").replace("++","+"));
            var new_url = bangs[bang].replace("{{{s}}}", new_query);
            //aRequest.QueryInterface(Ci.nsIHttpChannel).redirectTo(Services.io.newURI(new_url, null, null));
            aRequest.cancel(Cr.NS_BINDING_ABORTED);
            var gBrowser = windowUtils.getMostRecentBrowserWindow().gBrowser;
            var domWin = aProgress.DOMWindow;
            var browser = gBrowser.getBrowserForDocument(domWin.top.document);
            browser.loadURI(new_url);
        }
        this.oldURL = aURI.spec;
    },

    onStateChange: function() {},
    onProgressChange: function() {},
    onStatusChange: function() {},
    onSecurityChange: function() {}
};

for each (let window in windowUtils.windows()) {
    myExtension.init(window);
    window.addEventListener("unload", function() { myExtension.uninit(window) }, false);
}
windows.browserWindows.on("open", domWindow => {
    myExtension.init(domWindow);
    windowUtils.getMostRecentBrowserWindow().addEventListener("unload", function() { myExtension.uninit(domWindow); }, false);
});
