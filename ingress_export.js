// ==UserScript==
// @id iitc-plugin-ingressportalcsvexport@zetaphor
// @name IITC Plugin: Ingress Portal CSV Export - Map Scraper
// @category Information
// @version 0.0.1
// @namespace http://github.com/Zetaphor/IITC-Ingress-Portal-CSV-Export
// @updateURL http://github.com/Zetaphor/IITC-Ingress-Portal-CSV-Export/raw/master/ingress_export.js
// @downloadURL http://github.com/Zetaphor/IITC-Ingress-Portal-CSV-Export/raw/master/ingress_export.js
// @description Exports portals to a CSV list
// @include https://*.ingress.com/intel*
// @include http://*.ingress.com/intel*
// @match https://*.ingress.com/intel*
// @match http://*.ingress.com/intel*
// @grant none
// ==/UserScript==
/*global $:false */
/*global map:false */

/*global L:false */

function wrapper() {
    let maxLat = 85.05;
    let dw = false;
    let df = false;
    let prevMillis = -1;
    let avgTimer = -1;
    let tilesPassed = 0;
    let tilesLeft = 0;

    // in case IITC is not available yet, define the base plugin object
    if (typeof window.plugin !== "function") {
        window.plugin = function () {
        };
    }

    // base context for plugin
    window.plugin.portal_csv_export = function () {
    };
    const self = window.plugin.portal_csv_export;

    window.master_portal_list = {};
    window.portal_scraper_enabled = false;
    window.current_area_scraped = false;

    self.portalInScreen = function portalInScreen(p) {
        return map.getBounds().contains(p.getLatLng());
    };

    //  adapted from
    //+ Jonas Raoni Soares Silva
    //@ http://jsfromhell.com/math/is-point-in-poly [rev. #0]
    self.portalInPolygon = function portalInPolygon(polygon, portal) {
        const poly = polygon.getLatLngs();
        const pt = portal.getLatLng();
        let c = false;
        let i = -1;
        const l = poly.length;
        let j = l - 1;
        for (; ++i < l; j = i) {
            ((poly[i].lat <= pt.lat && pt.lat < poly[j].lat) || (poly[j].lat <= pt.lat && pt.lat < poly[i].lat)) && (pt.lng < (poly[j].lng - poly[i].lng) * (pt.lat - poly[i].lat) / (poly[j].lat - poly[i].lat) + poly[i].lng) && (c = !c);
        }
        return c;
    };

    // return if the portal is within the drawtool objects.
    // Polygon and circles are available, and circles are implemented
    // as round polygons.
    self.portalInForm = function (layer) {
        if (layer instanceof L.Rectangle) {
            return true;
        }
        return layer instanceof L.Circle;

    };

    self.portalInGeo = function (layer) {
        if (layer instanceof L.GeodesicPolygon) {
            return true;
        }
        return layer instanceof L.GeodesicCircle;

    };

    self.portalInDrawnItems = function (portal) {
        let c = false;

        window.plugin.drawTools.drawnItems.eachLayer(function (layer) {
            if (!(self.portalInForm(layer) || self.portalInGeo(layer))) {
                return false;
            }

            if (self.portalInPolygon(layer, portal)) {
                c = true;
            }
        });
        return c;
    };

    self.inBounds = function (portal) {
        if (window.plugin.drawTools && window.plugin.drawTools.drawnItems.getLayers().length) {
            return self.portalInDrawnItems(portal);
        } else {
            return self.portalInScreen(portal);
        }
    };

    self.genStr = function genStr(title, image, latt, lngt, portalGuid) {

        let lat = (latt + "").replace(".", ",");
        let lng = (lngt+"").replace(".", ",");
        const href = lat + ";" + lng;
        let str;
        str = title;
        str = str.replace(/"/g, "\\\"");
        str = str.replace(";", " ");
        str = str + "; " + href + "; " + image;
        if (window.plugin.keys && (typeof window.portals[portalGuid] !== "undefined")) {
            const keyCount = window.plugin.keys.keys[portalGuid] || 0;
            str = str + ";" + keyCount;
        }
        return str;
    };

    self.genStrFromPortal = function genStrFromPortal(portal, portalGuid) {
        const lat = portal._latlng.lat,
            lng = portal._latlng.lng,
            title = portal.options.data.title || "untitled portal";
        let image = portal.options.data.image || "";

        return self.genStr(title, image, lat, lng, portalGuid);
    };

    self.addPortalToExportList = function (portalStr, portalGuid) {
        if (typeof window.master_portal_list[portalGuid] === 'undefined') {
            window.master_portal_list[portalGuid] = portalStr;
            self.updateTotalScrapedCount()
        }
    };

    self.updateTotalScrapedCount = function () {
        $('#totalScrapedPortals').html(Object.keys(window.master_portal_list).length);
    };

    self.drawRectangle = function () {
        let bounds = window.map.getBounds();
        bounds = [[bounds._southWest.lat, bounds._southWest.lng], [bounds._northEast.lat, bounds._northEast.lng]];
        L.rectangle(bounds, {color: "#00ff11", weight: 1, opacity: 0.9}).addTo(window.map);
    };

    self.managePortals = function managePortals(obj, portal, x) {
        if (self.inBounds(portal)) {
            const str = self.genStrFromPortal(portal, x);
            obj.list.push(str);
            obj.count += 1;
            self.addPortalToExportList(str, x);
        }
        return obj;

    };

    self.checkPortals = function checkPortals(portals) {
        const obj = {
            list: [],
            count: 0
        };
        for (let x in portals) {
            // noinspection JSUnfilteredForInLoop
            if (typeof window.portals[x] !== "undefined") {
                // noinspection JSUnfilteredForInLoop
                self.managePortals(obj, window.portals[x], x);
            }
        }
        return obj;
    };

    self.generateCsvData = function () {
        let csvData = 'Name; Latitude; Longitude; Image' + "\n";
        $.each(window.master_portal_list, function (key, value) {
            csvData += (value + "\n");
        });

        return csvData;
    };

    self.downloadCSV = function() {
        const csvData = self.generateCsvData();
        const link = document.createElement("a");
        link.download = 'Portal_Export.csv';
        link.href = "data:text/csv," + escape(csvData);
        link.click();
    };

    self.showDialog = function showDialog() {
        const csvData = self.generateCsvData();

        const data = `
<form name='maxfield' action='#' method='post' target='_blank'>
<div class="row">
<div id='form_area' class="column" style="float:left;width:100%;box-sizing: border-box;padding-right: 5px;">
<textarea class='form_area'
name='portal_list_area'
rows='30'
placeholder='Zoom level must be 15 or higher for portal data to load'
style="width: 100%; white-space: nowrap;">${csvData}</textarea>
</div>
</div>
</form>
`;

        const dia = window.dialog({
            title: "Portal CSV Export",
            html: data
        }).parent();
        $(".ui-dialog-buttonpane", dia).remove();
        dia.css("width", "600px").css("top", ($(window).height() - dia.height()) / 2).css("left", ($(window).width() - dia.width()) / 2);
        return dia;
    };

    self.gen = function gen() {
        return self.showDialog(window.master_portal_list);
    };

    self.setZoomLevel = function () {
        window.map.setZoom(15);
        $('#currentZoomLevel').html('15');
        self.updateZoomStatus();
    };

    self.updateZoomStatus = function () {
        const zoomLevel = window.map.getZoom();
        // noinspection JSJQueryEfficiency
        $('#currentZoomLevel').html(window.map.getZoom());
        if (zoomLevel !== 15) {
            window.current_area_scraped = false;
            $('#currentZoomLevel').css('color', 'red');
            if (window.portal_scraper_enabled) $('#scraperStatus').html('Invalid Zoom Level').css('color', 'yellow');
        }
        else $('#currentZoomLevel').css('color', 'green');
    };

    self.updateTimer = function () {
        let tmp = $('#innerstatus').find('> span.map > span');
        self.updateZoomStatus();
        if (window.map.getZoom() === 3) {
            if (tmp.html() === 'done') {
                if (df) {
                    moveScanWindow();
                    //checkAreas();
                    self.checkPortals(window.portals);
                    //drawRectangle();
                }
            }
        }
        if (window.portal_scraper_enabled) {
            if (window.map.getZoom() === 15) {
                if (tmp.html() === 'done') {
                    if (!window.current_area_scraped) {
                        self.checkPortals(window.portals);
                        window.current_area_scraped = true;
                        $('#scraperStatus').html('Running').css('color', 'green');
                        self.drawRectangle();
                    } else {
                        $('#scraperStatus').html('Area Scraped').css('color', 'green');
                        if (dw) {
                            moveWindow();
                        }
                    }
                } else {
                    window.current_area_scraped = false;
                    $('#scraperStatus').html('Waiting For Map Data').css('color', 'yellow');
                }
            }
        }
    };

    self.panMap = function () {
        window.map.getBounds();
        window.map.panTo({lat: 40.974379, lng: -85.624982});
    };

    self.toggleStatus = function () {
        if (window.portal_scraper_enabled) {
            window.portal_scraper_enabled = false;
            $('#scraperStatus').html('Stopped').css('color', 'red');
            $('#startScraper').show();
            $('#stopScraper').hide();
            $('#csvControlsBox').hide();
            $('#totalPortals').hide();
            $('#scraping').html('Stopped').css('color', 'red');
            dw = false;
        } else {
            window.portal_scraper_enabled = true;
            $('#scraperStatus').html('Running').css('color', 'green');
            $('#startScraper').hide();
            $('#stopScraper').show();
            $('#csvControlsBox').show();
            $('#totalPortals').show();
            self.updateTotalScrapedCount();
            dw = true;
            $('#scraping').html('Running').css('color', 'green');
        }

    };

    self.toggleAutoStatus = function () {
        df = !df;
        if (df) {
            $('#startAutoScraper').html('Stop');
            $('#scraping').html('Running').css('color', 'green');
        } else {
            $('#scraping').html('Stopped').css('color', 'red');
            $('#startAutoScraper').html('Start');
        }
    };

    function toggleAutoStatus() {
        df = !df;
        if (df) {
            $('#startAutoScraper').html('Stop');
            $('#scraping').html('Running').css('color', 'green');
        } else {
            $('#scraping').html('Stopped').css('color', 'red');
            $('#startAutoScraper').html('Start');
        }
    }

    // setup function called by IITC
    self.setup = function init() {
        // add controls to toolbox
        const link = $("");
        $("#toolbox").append(link);

        const csvToolbox = `
            <div id="csvToolbox" style="position: relative;">
            <p style="margin: 5px 0 5px 0; text-align: center; font-weight: bold;">Portal CSV Exporter</p>
            <a id="startScraper" style="position: absolute; top: 0; left: 0; margin: 0 5px 0 5px;" onclick="window.plugin.portal_csv_export.toggleStatus();" title="Start the portal data scraper">Start</a>
            <a id="stopScraper" style="position: absolute; top: 0; left: 0; display: none; margin: 0 5px 0 5px;" onclick="window.plugin.portal_csv_export.toggleStatus();" title="Stop the portal data scraper">Stop</a>

            <div class="zoomControlsBox" style="margin-top: 5px; padding: 5px 0 5px 5px;">
            Current Zoom Level: <span id="currentZoomLevel">0</span>
            <a style="margin: 0 5px 0 5px;" onclick="window.plugin.portal_csv_export.setZoomLevel();" title="Set zoom level to enable portal data download.">Set Zoom Level</a>
            </div>

            <p style="margin:0 0 0 5px;">Scraper Status: <span style="color: red;" id="scraperStatus">Stopped</span></p>
            <p id="totalPortals" style="display: none; margin:0 0 0 5px;">Total Portals Scraped: <span id="totalScrapedPortals">0</span></p>
            <p style="margin:5px 0 0 5px;">Auto Scraper Status: <span style="color: red;" id="scraping">Stopped</span></p>
            <p style="margin:5px 0 0 5px;">Current Location: <br><span style="color: yellow;" id="curloc"><span style="color: yellow" id="curlat"></span><br><span style="color: yellow" id="curlng"></span></span></p>
            <p style="margin:5px 0 0 5px;">Sections Left: <span style="color: yellow;" id="sectLeft">0</span></p>
            <p style="margin:5px 0 0 5px;">Time Left(WIP): <span style="color: yellow;" id="timeLeft">0</span></p>
            <a id="startAutoScraper" style="margin: 0 5px 0 5px;" onclick="window.plugin.portal_csv_export.toggleAutoStatus();" title="Start automatic portal data scraper">Start</a>

            <div id="csvControlsBox" style="display: none; margin-top: 5px; padding: 5px 0 5px 5px; border-top: 1px solid #20A8B1;">
            <a style="margin: 0 5px 0 5px;" onclick="window.plugin.portal_csv_export.gen();" title="View the CSV portal data.">View Data</a>
            <a style="margin: 0 5px 0 5px;" onclick="window.plugin.portal_csv_export.downloadCSV();" title="Download the CSV portal data.">Download CSV</a>
            </div>

            </div>
        `;

        $(csvToolbox).insertAfter('#toolbox');

        window.csvUpdateTimer = window.setInterval(self.updateTimer, 500);

        // delete self to ensure init can't be run again
        map.setZoom(3);
        //map.setZoom(15);

        //$('#curloc').html("\nlat: "+maxLat+"\nlng: -180");
        $('#curlat').html("lat: " + map.getCenter().lat);
        $('#curlng').html("lng: " + map.getCenter().lng);

        //         console.log(latS+", "+lngS);
        //         console.log(new L.LatLng(maxLat-latS/7.5, -180+lngS/2));
        //         console.log(map.getBounds());
        setTimeout(function () {
            let swLat = map.getBounds()._southWest.lat;
            let swLng = map.getBounds()._southWest.lng;
            let neLat = map.getBounds()._northEast.lat;
            let neLng = map.getBounds()._northEast.lng;
            let latS = Math.abs(neLat - swLat);
            let lngS = Math.abs(neLng - swLng);
            map.setView(new L.LatLng(maxLat - latS / 3.97, -180 + lngS / 2));
            tilesLeft = Math.round((maxLat * 2 / latS) * (180 * 2 / lngS));
            $('#sectLeft').html(tilesLeft);
            delete self.init;
        }, 100);
        //         map.setView(new L.LatLng(maxLat-latS/7.5, -180+lngS/2));

        //         alert("View set to: "+(maxLat-latS/7.5)+", "+ (-180+lngS/2));
//         tilesLeft = Math.floor((maxLat*2/latS)*(180*2/lngS));
//         $('#sectLeft').html(tilesLeft);
//         delete self.init;
    };

    function moveWindow() {
        let swLat = map.getBounds()._southWest.lat;
        let swLng = map.getBounds()._southWest.lng;
        let neLat = map.getBounds()._northEast.lat;
        let neLng = map.getBounds()._northEast.lng;
        let latS = Math.abs(neLat - swLat);
        let lngS = Math.abs(neLng - swLng);
        let newLat = map.getCenter().lat + latS;
        let newLng = map.getCenter().lng + lngS;
        if (newLng > 180) {
            newLng = -180;
            if (newLat < -85) {
                self.downloadCSV();
                alert("finished!");
                dw = false;
                return;
            }
            map.setView(new L.LatLng(newLat, newLng));
        }
        map.setView(new L.LatLng(map.getCenter().lat, newLng));
        //$('#curloc').html(map.getCenter().lng+", "+map.getCenter().lat);
        //$('#curloc').html("\nlat: "+map.getCenter().lng+"\nlng: "+map.getCenter().lat);
        $('#curlat').html("lat: " + map.getCenter().lat);
        $('#curlng').html("lng: " + map.getCenter().lng);
        tilesLeft--;
        tilesPassed++;
        $('#sectLeft').html(tilesLeft);
        if (prevMillis === -1) {
            prevMillis = Date.now();
        } else {
            //$('#timeLeft').html((Date.now()-prevMillis));
            //new Date(ms).toISOString().slice(11, -1);
            if (avgTimer === -1) {
                avgTimer = Date.now() - prevMillis;
            } else {
                avgTimer = avgTimer * tilesPassed + (Date.now() - prevMillis);
                avgTimer /= tilesPassed + 1;
            }
            //$('#timeLeft').html(new Date(avgTimer*tilesLeft).toISOString().slice(11, -1) + "<br>" + avgTimer);
            let tmp = new Date(avgTimer * tilesLeft);
            $('#timeLeft').html(tmp.getYear() + "/" + tmp.getMonth() + "/" + tmp.getDate() + " " + tmp.getHours() + ":" + tmp.getMinutes() + ":" + tmp.getSeconds() + "<br>" + avgTimer * tilesLeft);
            prevMillis = Date.now();
        }
    }

    let over = false;

    function moveScanWindow() {
        let swLat = map.getBounds()._southWest.lat;
        let swLng = map.getBounds()._southWest.lng;
        let neLat = map.getBounds()._northEast.lat;
        let neLng = map.getBounds()._northEast.lng;
        let latS = Math.abs(neLat - swLat);
        let lngS = Math.abs(neLng - swLng);
        let newLat = map.getCenter().lat - latS;
        let newLng = map.getCenter().lng + lngS;
        if (newLng >= 180 && !over) {
            newLng = 180 - lngS / 2;
//             console.log("#1: "+newLat+", "+newLng);
            map.setView(new L.LatLng(map.getCenter().lat, newLng));
            over = true;
        } else if (over) {
            newLng = -180 + lngS / 2;
            map.setView(new L.LatLng(newLat, newLng));
            over = false;
            if (newLat < -85) {
                self.downloadCSV();
                console.log("finished!");
                toggleAutoStatus();
                map.setView(new L.LatLng(0, 0));
                return;
            }
        } else {
//             console.log("#2: "+newLng);
            map.setView(new L.LatLng(map.getCenter().lat, newLng));
        }
        //$('#curloc').html(map.getCenter().lng+", "+map.getCenter().lat);
        //$('#curloc').html("\nlat: "+map.getCenter().lng+"\nlng: "+map.getCenter().lat);
        $('#curlat').html("lat: " + map.getCenter().lat);
        $('#curlng').html("lng: " + map.getCenter().lng);
        tilesLeft--;
        tilesPassed++;
        $('#sectLeft').html(tilesLeft);
        if (prevMillis === -1) {
            prevMillis = Date.now();
        } else {
            //$('#timeLeft').html((Date.now()-prevMillis));
            //new Date(ms).toISOString().slice(11, -1);
            if (avgTimer === -1) {
                avgTimer = Date.now() - prevMillis;
            } else {
                avgTimer = avgTimer * tilesPassed + (Date.now() - prevMillis);
                avgTimer /= tilesPassed + 1;
            }
            //$('#timeLeft').html(new Date(avgTimer*tilesLeft).toISOString().slice(11, -1) + "<br>" + avgTimer);
            let tmp = new Date(avgTimer * tilesLeft);
            $('#timeLeft').html(tmp.getFullYear() + "/" + tmp.getMonth() + "/" + tmp.getDate() + " " + tmp.getHours() + ":" + tmp.getMinutes() + ":" + tmp.getSeconds() + "<br>" + avgTimer * tilesLeft);
            prevMillis = Date.now();
        }
    }

    // IITC plugin setup
    if (window.iitcLoaded && typeof self.setup === "function") {
        self.setup();
    } else if (window.bootPlugins) {
        window.bootPlugins.push(self.setup);
    } else {
        window.bootPlugins = [self.setup];
    }
}

// inject plugin into page
const script = document.createElement("script");
script.appendChild(document.createTextNode("(" + wrapper + ")();"));
(document.body || document.head || document.documentElement)
    .appendChild(script);