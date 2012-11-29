/*
 * Copyright (c) 2012, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*jslint anon:true, sloppy:true, nomen:true*/
/*global YUI*/


/**
 * @module ResourceStoreAddon
 */

/**
 * @class RSAddonUrl
 * @extension ResourceStore.server
 */
YUI.add('addon-rs-shaker', function(Y, NAME) {

    var libpath = require('path');

    function RSAddonShaker() {
        RSAddonShaker.superclass.constructor.apply(this, arguments);
    }

    RSAddonShaker.NS = 'shaker';
    RSAddonShaker.ATTRS = {};

    ShakerNS = Y.namespace('mojito.shaker');

    Y.extend(RSAddonShaker, Y.Plugin.Base, {

        initializer: function(config) {
            this.rs = config.host;
            this._poslCache = {};   // context: POSL
            this.appRoot = config.appRoot;
            this.mojitoRoot = config.mojitoRoot;
            this.appConfig = config.host.getStaticAppConfig() || {};
            this.shakerConfig = this.appConfig.shaker || {};

            var yuiRS = this.rs.yui;

            if (!this.initilized) {
                this.meta = this.rs.config.readConfigSimple(libpath.join(this.appRoot, 'shaker-meta.json'));
                if(this.meta && !Y.Object.isEmpty(this.meta)) {
                    Y.log('Metadata loaded correctly.','info','Shaker');
                    Y.log('Preloading store', 'info','mojito-store');
                } else {
                    Y.log('Metadata not found.','warn','Shaker');
                    return;
                }
            }
            //either on build tim or runtime we need to change the urls...
            //but only when comboCDN is enabled.
            if (this.shakerConfig.comboCDN) {
                this.beforeHostMethod('resolveResourceVersions', this.resolveResourceVersions, this);
            }

            //if we are in runtime we need to hook some methods...
            if (!process.shakerCompile) {
                //alter seed
                if (this.shakerConfig.comboCDN) {
                    Y.Do.after(this.alterAppSeedFiles, yuiRS, 'getAppSeedFiles', this);
                }

                //alter bootstrap config
                //Y.Do.after(function (){console.log(Y.Do.currentRetVal);}, yuiRS, 'getAppGroupConfig', this);

                //augments the view with assets
                this.onHostEvent('mojitResourcesResolved', this.mojitResourcesResolved, this);

                //for hooking in to the content.
                //not yet necesary, but it will...
                //this.beforeHostMethod('processResourceContent', this.precomputeResource, this);
            }
        },
        destructor: function() {
            // TODO:  needed to break cycle so we don't leak memory?
            this.rs = null;
        },
        alterAppSeedFiles: function () {
            var i,
                newUrl,
                cdnUrls = this.meta.cdnModules;
                currentSeed = Y.Do.currentRetVal;

            for (i in currentSeed) {
                newUrl = cdnUrls[currentSeed[i]];
                if (newUrl) {
                    currentSeed[i] = newUrl;
                }
            }
            //console.log(currentSeed);
        },
        /*
        * Here we need to change the urls
        */
        resolveResourceVersions: function (cdnUrls) {
            var r,
                res,
                ress,
                m,
                mojit,
                mojits,
                meta,
                urls = {};

            //get rewritten urls
            cdnUrls = cdnUrls || this.meta.cdnModules;

            if(!cdnUrls) {
                return;
            }

            //iterate over mojits
            mojits = this.rs.listAllMojits();
            mojits.push('shared');

            for (m = 0; m < mojits.length; m += 1) {
                mojit = mojits[m];
                ress = this.rs.getResourceVersions({mojit: mojit});
                for (r = 0; r < ress.length; r += 1) {
                    res = ress[r];
                    //CHECK ABOUT THE VIEWS HERE...
                    if (res.yui && cdnUrls[res.url]) {
                        res.url = cdnUrls[res.url];
                    }
                }
            }

        },
        mojitResourcesResolved: function (e) {
            var env = e.env,
                posl = e.posl,
                mojitName = e.mojit,
                ress = e.ress,
                strContext = posl.join('-'),
                isFrame = mojitName.indexOf('ShakerHTMLFrameMojit') !== -1,
                shakerMeta = this.meta,
                shakerBase,
                frameActionMeta,
                actionMeta,
                css,
                resource;
                
            if (!shakerMeta) {
                return;
            }
            //if the mojit is the ShakerHTMLFrame, we are going to put the common assets there.
            if (isFrame) {
                shakerBase = shakerMeta.app[strContext];
                shakerBase = shakerBase && shakerBase.app;
                frameActionMeta = {
                    css: shakerBase
                };
            } else {
                //I do this to check if on the nested meta we have all the info we need...
                //NOTE: May I implement a getter from the metadata?
                shakerBase = shakerMeta.app[strContext];
                shakerBase = shakerBase && shakerBase.mojits[mojitName];
            }

            for(var i in ress) {
                //ress[i].url = 'http://yahoo.com/foo.js';
                resource = ress[i];
                //we got a view, let's attach the proper assets
                if (resource.type === 'view') {
                     actionMeta =  (isFrame ? frameActionMeta: shakerBase && shakerBase[resource.name]) || {css:[], blobCSS:[]};
                     ress[i].view.assets = {
                        topShaker: {
                            css: actionMeta.css,
                            blob: actionMeta.blobCSS || []
                        }
                    };
                }
            }
        },
        precomputeResource: function(res, content, stat, callback) {
            //eventually...
        }
       
    });
    Y.namespace('mojito.addons.rs');
    Y.mojito.addons.rs.shaker = RSAddonShaker;

}, '0.0.1', { requires: ['plugin', 'oop','addon-rs-url','addon-rs-yui']});
