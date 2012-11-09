/*
 * Copyright (c) 2011-2012, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */
 
YUI.add('mojito-shaker-addon', function(Y, NAME) {

    function arrayDiff(origin, exclude) {
        origin = origin || [];
        if (!exclude || !exclude.length) {
            return origin;
        }
        return origin.filter(function (i) {
            return (exclude.indexOf(i) <= -1);
        });
    }

    function ShakerAddon(command, adapter, ac) {
        this._ac = ac;// the future action context of the mojit (not attached yet if mojit created dynamically)
        this._adapter = adapter;// where the functions done and error live before attach them to the ac.
        this._command = command;//all the configuration for the mojit
        this._init(ac, adapter);
    }
    ShakerAddon.prototype = {
        namespace: 'shaker',
        _init:function (ac, adapter) {
            var metaLoaded = this._initShaker();
            this._deployClient = (ac.config && ac.config.get('deploy')) ||
                                 (ac.instance.config && ac.instance.config.deploy === true);

            this._augmentAppAssets(ac);
            if (metaLoaded) {
                this._hookDeploy(ac, adapter);
            } else {
                Y.log('[SHAKER] Metadata not found. Application running without Shaker...','error');
            }
        },
        _initShaker: function (){
            var shakerMeta = this._adapter.req.app.store.shaker.meta,
                config = this._ac.app ? this._ac.app.config.shaker : this._ac.config.getAppConfig().shaker;
            this._shakerConfig = config || {};
            this._meta = shakerMeta || {};
            return shakerMeta;
        },
        /*
        * We add here the assets at the app level
        */
        _augmentAppAssets: function (ac) {
            var instance = ac.command.instance,
                action = instance.action || ac.command.action || 'index',
                viewObj = instance.views[action] || {},
                actionAssets = viewObj && viewObj.assets;

            ac.assets.addAssets(actionAssets);
            delete viewObj.assets;
        },
        /*
        * We have to hook after the getSripts function gets executed (and the assets of the framework get merged)
        * so we can remove/bypass the bottom calculated assets by mojito
        * check _removeMojitoCalculatedAssets.
        */
        _hookDeploy: function (ac) {
            var originalFnc = ac.deploy.getScripts,
                proxyFnc = this._removeMojitoCalculatedAssets;
            ac.deploy.getScripts = function () {
                return proxyFnc(originalFnc.apply(this, arguments));
            };
        },
        _removeMojitoCalculatedAssets: function (calculatedAssets) {
            delete calculatedAssets.bottom;
            return calculatedAssets;
        },
        checkClienDeployment: function () {
            var ac = this._ac,
                assets = ac.assets.getAssets();
            if (!this._deployClient) {
                delete assets.bottomShaker;
            }
        },
        /*
        * This function is not being used any more
        * but eventually we need to figure out how to make it work
        */
        checkLowCoveredMojits: function (assets, route, metaBundle, metaShakerApp) {
            var shakerConfig = this._shakerConfig,
                executedMojits = assets.shakerRuntimeMeta && assets.shakerRuntimeMeta.mojits,
                routeMojits = shakerConfig.routeBundle[route.name],
                lowCoverageMojits = arrayDiff(executedMojits, routeMojits),
                mojit;

            //console.log(lowCoverageMojits);

            lowCoverageMojits.forEach(function (mojitActionName) {
                var parts = mojitActionName.split('.'),
                    mojitName = parts[0],
                    mojitAction = parts[1],
                    mojitAssets = metaShakerApp.mojits[mojitName] || {},
                    mojitActionAssets = mojitAssets[mojitAction] || [];

                    //console.log(mojitActionAssets);
                    //TODO: MERGE THE LOW COVERAGE ASSETS WITH THE BUNDLE!!!!!
            });

        },
        checkRouteBundling: function () {
            if(!this._meta.app) return;

            var ac = this._ac,
                adapter = this._adapter,
                core = this._meta.core,
                command = this._command,
                store = adapter.req.app.store,
                url = adapter.req.url,
                method = adapter.req.method,
                route = ac.url.find(url, method),
                strContext = store.selector.getPOSLFromContext(ac.context).join('-'),
                shakerApp = this._meta.app[strContext],
                shakerBundle = shakerApp.routesBundle[route.name],
                assets = ac.assets.getAssets(),
                shakerAssetsTop = {},
                shakerAssetsBottom = {};

            if (shakerBundle) {
                //this.checkLowCoveredMojits(assets, route, shakerBundle, shakerApp);
                shakerAssetsTop = assets.topShaker || {js:[], css: []};
                shakerAssetsBottom = assets.bottomShaker || {js:[], css: []};
                shakerAssetsTop.css = shakerBundle.css;
                shakerAssetsBottom.js = core.concat(shakerBundle.js);
                //revisit this thing
                assets.bottomShaker = shakerAssetsBottom;
                assets.topShaker = shakerAssetsTop;
            }

            
        },
        run: function (meta) {
            this.checkClienDeployment();
            this.checkRouteBundling();
        }
    };

    Y.mojito.addons.ac.shaker = ShakerAddon;

}, '0.0.1', {requires: ['mojito', 'mojito-config-addon']});
