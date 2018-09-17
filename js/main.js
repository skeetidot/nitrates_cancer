/* Define Global Variables */

// Esri basemap tiles
var Esri_WorldGrayCanvas = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
});

var Esri_WorldGrayReference = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
});

// Mapbox Light basemap
var mapboxLight = L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
    attribution: 'Tiles &copy; Mapbox',
    id: 'mapbox.light',
    accessToken: 'pk.eyJ1Ijoic2tlZXRpZG90IiwiYSI6ImNqZW5vZ3cxdDEycWwyeW8wbXJndml0aG8ifQ.hDvVg6wvVxGy6xGL9ZBOdw',
    detectRetina: true
});

// Initialize layers in global scope, to include them in the layer list
var wellPointsLayerGroup = L.layerGroup(),
    censusTractsLayerGroup = L.layerGroup(),
    nitrateRatesIDWLayerGroup = L.layerGroup(),
    cancerRatesIDWLayerGroup = L.layerGroup(),
    collectedFeaturesLayerGroup = L.layerGroup();


// Initialize global variables for data layers
var censusTracts,
    wellPoints,
    cancerRatesHexbins,
    nitrateRatesHexbins;


// Initialize global variables for the distance decay coefficient and hexbin size with default values
var distanceDecayCoefficient = 2,
    hexbinArea = 10; // 10 sq km


// Initialize arrays to store the well points, census tracts, interpolated nitrate rates, and interpolated cancer rates
var wellPointsArray = [],
    censusTractsArray = [],
    interpolatedNitrateRatesArray = [],
    interpolatedCancerRatesArray = [];


// Initialize global variables for the Turf.js feature collections
var censusTractCentroidsTurf,
    wellPointsFeatureCollection,
    nitrateRatesHexbinsTurf,
    cancerRatesGridPointsTurf,
    collectedFeatures;


// Initialize global variables for the layer list and overlays
var layerList,
    overlays;


// Set the basemap for the layer list
// Only include one basemap so it is not part of the layer list
var baseMaps = {
    "Grayscale": Esri_WorldGrayCanvas
};


// Set the overlays to include in the layer list
var overlays = {
    "Well Points": wellPointsLayerGroup,
    "Census Tracts": censusTractsLayerGroup,
};


// Set the map options
var mapOptions = {
    center: [44.437778, -90.130186], // centered in central Wisconsin
    zoom: 7,
    minZoom: 7,
    maxZoom: 17,
    maxBounds: L.latLngBounds([40.822448, -80.120168], [48.628936, -100.325876]), // panning bounds so the user doesn't pan too far away from Wisconsin
    bounceAtZoomLimits: false, // Set it to false if you don't want the map to zoom beyond min/max zoom and then bounce back when pinch-zooming
    layers: [Esri_WorldGrayCanvas, wellPointsLayerGroup, censusTractsLayerGroup, nitrateRatesIDWLayerGroup, cancerRatesIDWLayerGroup, collectedFeaturesLayerGroup] // Set the layers to build into the layer control
};


// Create a new Leaflet map with the map options
var map = L.map('map', mapOptions);


// Add the zoom control in the top left corner
map.zoomControl.setPosition('topleft');


// Add the basemaps
map.addLayer(Esri_WorldGrayCanvas);
map.addLayer(Esri_WorldGrayReference);


// Listen for the Submit or Reset buttons. If clicked, get the UI parameters and update the map.
getUIActions();


// Build the initial layer list
buildLayerList(overlays);


// Build the sidebar and add it to the map
// Source: https://github.com/nickpeihl/leaflet-sidebar-v2
var sidebar = L.control.sidebar({
    autopan: false, // whether to maintain the centered map point when opening the sidebar
    closeButton: true, // whether to add a close button to the panes
    container: 'sidebar', // the DOM container or #ID of a predefined sidebar container that should be used
    position: 'left', // left or right
}).addTo(map);


// Open the home tab of the sidebar
sidebar.open('home');


// Use JQuery's getJSON() method to load the census tract and cancer rate data asynchronously
$.getJSON("data/cancer_tracts.json", function (data) {

    // Create a Leaflet GeoJson layer for the census tracts and add it to the census tracts layer group
    censusTracts = L.geoJson(data, {

        // Create a style for the census tracts
        style: function (feature) {
            return {
                color: '#585858', // set stroke color
                weight: 0.25, // set stroke weight
                fillOpacity: 0.5, // override the default fill opacity
                opacity: 1 // border opacity
            };
        }

    }).addTo(censusTractsLayerGroup);

    // Draw the census tracts
    drawCensusTracts();
});


// Use JQuery's getJSON() method to load the well point and nitrate concentration data asynchronously
$.getJSON("data/well_nitrate.json", function (data) {

    // CREATE A LEAFLET GEOJSON LAYER FOR THE WELL POINTS WITH POPUPS AND ADD TO THE MAP
    wellPoints = L.geoJson(data, {

        // CREATE STYLING FOR THE WELL POINTS LAYER
        pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng, {
                fillColor: '#3d3d3d',
                fillOpacity: 1,
                color: '#3d3d3d',
                weight: 0.25,
                opacity: 1,
                radius: 2.5
            });
        }

    }).addTo(wellPointsLayerGroup);

    // Draw the well points
    drawWellPoints();

});


// Draw census tracts, symbolized by cancer rate
// Get the class breaks based on the ckmeans classification method
// Loop through each tract and:
// 1. Set its color based on which cluster its cancer rate falls into
// 2. Build and bind its popup
// Draw the legend
function drawCensusTracts() {

    // Get the class breaks based on the ckmeans classification method
    var breaks = getCancerRateClassBreaks(censusTracts);

    // Loop through each feature
    censusTracts.eachLayer(function (layer) {

        // Set its color based on the cancer rate
        layer.setStyle({
            fillColor: getCancerRateColor(layer.feature.properties.canrate, breaks)
        });

        // Build the popup for the census tract
        var popup = "<b>Cancer Rate: </b>" + (layer.feature.properties.canrate * 100).toLocaleString() + "%";

        // Bind the popup to the tract
        layer.bindPopup(popup);

    });

    // Draw the legend for the census tracts
    drawCancerRatesLegend(breaks);

    // Move census tracts to the back of the layer order
    censusTracts.bringToBack();

} // end drawCensusTracts()


// Establish classification breaks for cancer rates
function getCancerRateClassBreaks(cancerRatesDataSource) {

    // Create an empty array to store the cancer rates
    var values = [];

    // Loop through each feature to get its cancer rate
    cancerRatesDataSource.eachLayer(function (layer) {
        var value = layer.feature.properties.canrate;

        // Push each cancer rate into the array
        values.push(value);
    });

    // Determine 5 clusters of statistically similar values, sorted in ascending order
    var clusters = ss.ckmeans(values, 5);

    // Create a 2-dimensional array of the break points (lowest and highest values) in each cluster. The lowest value in each cluster is cluster[0]; the highest value is cluster.pop().
    var breaks = clusters.map(function (cluster) {
        return [cluster[0], cluster.pop()];
    });

    // Return the array of class breaks
    return breaks;

} // end getCancerRateClassBreaks()       


// Set the color of the features depending on which cluster the value falls in
function getCancerRateColor(d, breaks) {

    // If the data value <= the upper value of the first cluster
    if (d <= breaks[0][1]) {
        return '#f1eef6';

        // If the data value <= the upper value of the second cluster    
    } else if (d <= breaks[1][1]) {
        return '#bdc9e1';

        // If the data value <= the upper value of the third cluster   
    } else if (d <= breaks[2][1]) {
        return '#74a9cf';

        // If the data value <= the upper value of the fourth cluster   
    } else if (d <= breaks[3][1]) {
        return '#2b8cbe';

        // If the data value <= the upper value of the fifth cluster  
    } else if (d <= breaks[4][1]) {
        return '#045a8d';

    }
} // end getCancerRateColor()


// Create the legend for cancer rates by census tract  
function drawCancerRatesLegend(breaks) {

    // Create a new Leaflet control object, and position it bottom left
    var legend = L.control({
        position: 'bottomright'
    });

    // When the legend is added to the map
    legend.onAdd = function () {

        // Create a new HTML <div> element and give it a class name of "legend"
        var div = L.DomUtil.create('div', 'legend');

        // First append an <h3> heading tag to the div holding the current attribute
        div.innerHTML = "<h3><b>Cancer Rate (% per Census Tract)</b></h3>";

        // For each of our breaks
        for (var i = 0; i < breaks.length; i++) {

            // Determine the color associated with each break value, including the lower range value
            var color = getCancerRateColor(breaks[i][0], breaks);

            // Concatenate a <span> tag styled with the color and the range values of that class and include a label with the low and high ends of that class range
            div.innerHTML +=
                '<span style="background:' + color + '"></span> ' +
                '<label>' + parseFloat(breaks[i][0] * 100).toFixed(2).toLocaleString() + '% &mdash; ' +
                parseFloat(breaks[i][1] * 100).toFixed(2).toLocaleString() + '%</label>';

        }

        // Return the populated legend div to be added to the map   
        return div;

    }; // end onAdd method

    // Add the legend to the map
    legend.addTo(map);

} // end drawCancerRatesLegend()


// Draw well points, symbolized by nitrate concentration
// Get the class breaks based on the ckmeans classification method
// Loop through each well and:
// 1. Set its color based on which cluster its nitrate rate falls into
// 2. Build and bind its popup
// Draw the legend    
function drawWellPoints() {

    // Get the class breaks based on the ckmeans classification method
    var breaks = getNitrateRateClassBreaks(wellPoints);

    // Loop through each feature
    wellPoints.eachLayer(function (layer) {

        // Set its color based on the nitrate rate
        layer.setStyle({
            fillColor: getNitrateRateColor(layer.feature.properties.nitr_ran, breaks)
        });

        // Build the popup for the well point
        var popup = "<b>Nitrate Concentration: </b>" + layer.feature.properties.nitr_ran.toFixed(2) + " ppm";

        // Bind the popup to the well point
        layer.bindPopup(popup);

    });

    // Draw the legend for the well points
    drawNitrateRatesLegend(breaks);

    // Move the well points to the top of the layer order
    //wellPoints.bringToFront();

} // end drawWellPoints()


// Establish classification breaks for nitrate concentrations
function getNitrateRateClassBreaks(nitrateRatesDataSource) {

    // Create an empty array to store the nitrate rates
    var values = [];

    // Loop through each feature to get its nitrate rate
    nitrateRatesDataSource.eachLayer(function (layer) {
        var value = layer.feature.properties.nitr_ran;

        // Push each nitrate rate into the array
        values.push(value);
    });

    // Determine 5 clusters of statistically similar values, sorted in ascending order
    var clusters = ss.ckmeans(values, 5);

    // Create a 2-dimensional array of the break points (lowest and highest values) in each cluster. The lowest value in each cluster is cluster[0]; the highest value is cluster.pop().
    var breaks = clusters.map(function (cluster) {
        return [cluster[0], cluster.pop()];
    });

    // Return the array of class breaks
    return breaks;

} // end getNitrateRateClassBreaks()


// Set the color of the features depending on which cluster the value falls in
function getNitrateRateColor(d, breaks) {

    // If the data value <= the upper value of the first cluster
    if (d <= breaks[0][1]) {
        return '#fef0d9';

        // If the data value <= the upper value of the second cluster    
    } else if (d <= breaks[1][1]) {
        return '#fdcc8a';

        // If the data value <= the upper value of the third cluster   
    } else if (d <= breaks[2][1]) {
        return '#fc8d59';

        // If the data value <= the upper value of the fourth cluster   
    } else if (d <= breaks[3][1]) {
        return '#e34a33';

        // If the data value <= the upper value of the fifth cluster  
    } else if (d <= breaks[4][1]) {
        return '#b30000';

    }
} // end getNitrateRateColor()


// Create the legend for cancer rates by census tract    
function drawNitrateRatesLegend(breaks) {

    // Create a new Leaflet control object, and position it bottom left
    var legend = L.control({
        position: 'bottomright'
    });

    // When the legend is added to the map
    legend.onAdd = function () {

        // Create a new HTML <div> element and give it a class name of "legend"
        var div = L.DomUtil.create('div', 'legend');

        // First append an <h3> heading tag to the div holding the current attribute
        div.innerHTML = "<h3><b>Nitrate Concentration (parts per million)</b></h3>";

        // For each of our breaks
        for (var i = 0; i < breaks.length; i++) {

            // Determine the color associated with each break value, including the lower range value
            var color = getNitrateRateColor(breaks[i][0], breaks);

            // Concatenate a <span> tag styled with the color and the range values of that class and include a label with the low and high ends of that class range
            div.innerHTML +=
                '<span style="background:' + color + '"></span> ' +
                '<label>' + parseFloat(breaks[i][0]).toFixed(2).toLocaleString() + ' &mdash; ' +
                parseFloat(breaks[i][1]).toFixed(2).toLocaleString() + ' ppm' + '</label>';

        }

        // Return the populated legend div to be added to the map   
        return div;

    }; // end onAdd method

    // Add the legend to the map
    legend.addTo(map);

} // end drawNitrateRatesLegend()


// Build the layer list
function buildLayerList(overlays) {

    // Add the layer control to the map
    layerList = L.control.layers(baseMaps, overlays, {
        collapsed: false, // Keep the layer list open
        autoZIndex: true, // Assign zIndexes in increasing order to all of its layers so that the order is preserved when switching them on/off
        hideSingleBase: true // Hide the base layers section when there is only one layer
    }).addTo(map);

} // end buildLayerList()


// When the user clicks Submit or Reset
// 1. Clear the existing layers and legend
// 2. If Submit is clicked, get the distance decay coefficient and hexbin size and redraw the map with the interpolated layers
// 3. If Reset is clicked, redraw the map with the original well points and census tracts
function getUIActions() {

    // Select the submit button
    var submit = $('#submitButton');

    // When the user clicks submit
    submit.on('click', function (e) {

        console.log("clicked submit");

        // Remove the current layers from the map

        if (wellPoints !== undefined) {
            wellPoints.remove();
        }

        if (censusTracts !== undefined) {
            censusTracts.remove();
        }

        if (nitrateRatesHexbins !== undefined) {
            nitrateRatesHexbins.remove();
        }

        if (cancerRatesHexbins !== undefined) {
            cancerRatesHexbins.remove();
        }

        // Use the JQuery select $() and val() methods to determine the value of the distance decay coefficient text box
        distanceDecayCoefficient = $('#distanceDecayCoefficient').val();
        distanceDecayCoefficient = parseFloat(distanceDecayCoefficient);

        // Use the JQuery select $() and val() methods to determine the value of the hexbin size text box
        hexbinArea = $('#hexbinArea').val();
        hexbinArea = parseFloat(hexbinArea);

        console.log("Distance Decay Coefficient: " + distanceDecayCoefficient);
        console.log("Hexbin Area: " + hexbinArea);

        // Hide the current legend
        $('.legend').hide();

        // Remove the current layer list
        layerList.remove();

        // Set the overlays to include in the updated layer list
        overlays = {
            "Nitrate Concentrations": nitrateRatesIDWLayerGroup,
            "Cancer Rates": cancerRatesIDWLayerGroup,
            "Collected Features": collectedFeaturesLayerGroup
        };

        // Rebuild the layer list with the new list of overlays
        buildLayerList(overlays);

        // Call the function to interpolate nitrate rates and generate a hexbin surface
        interpolateNitrateRates(distanceDecayCoefficient, hexbinArea);

        // Call the function to interpolate cancer rates and generate a hexbin surface
        interpolateCancerRates(distanceDecayCoefficient, hexbinArea);

        // Call the function to join the hexbins, resulting in a hexbin surface with nitrate concentrations and cancer rates
        joinCancerRatesToNitrateInterpolation(distanceDecayCoefficient, hexbinArea);


    });

    // Select the reset button
    var reset = $('#resetButton');

    // When the user clicks reset
    reset.on('click', function (e) {

        console.log("clicked reset");

        // Hide the current legend
        $('.legend').hide();

        // Remove the current layers from the map
        if (wellPoints !== undefined) {
            wellPoints.remove();
        }

        if (censusTracts !== undefined) {
            censusTracts.remove();
        }

        if (nitrateRatesHexbins !== undefined) {
            nitrateRatesHexbins.remove();
        }

        if (cancerRatesHexbins !== undefined) {
            cancerRatesHexbins.remove();
        }

        // Add census tracts and well points back to the map
        censusTracts.addTo(map);
        wellPoints.addTo(map);

        // Call the function to redraw the well points
        drawWellPoints();

        // Call the function to redraw the census tracts
        drawCensusTracts();

        // Hide and redraw the layer list
        layerList.remove();

        // Set the overlays to include in the layer list
        overlays = {
            "Well Points": wellPointsLayerGroup,
            "Census Tracts": censusTractsLayerGroup
        };

        // Move the census tracts to the bottom of the layer order
        censusTracts.bringToBack();

        // Rebuild the layer list with the new list of overlays
        buildLayerList(overlays);

    });

}


// Build a Turf feature collection from the tract centroids
// Call the interpolateCancerRates() method to interpolate the cancer rates to hexbins
// Interpolate the cancer rates from the census tracts into a hexbin surface (http://turfjs.org/docs#interpolate)
function interpolateCancerRates(distanceDecayCoefficient, hexbinArea) {

    // Remove any previous features from the layer group    
    if (cancerRatesIDWLayerGroup !== undefined) {
        cancerRatesIDWLayerGroup.clearLayers();
    }

    // Loop through each feature
    censusTracts.eachLayer(function (layer) {

        // Build a Turf feature collection from the census tracts

        // Create shorthand variable to access the layer properties and coordinates
        var props = layer.feature.properties;
        var coordinates = layer.feature.geometry.coordinates;

        //console.log("Census Tract Coordinates:")
        //console.log(coordinates);

        // Create a turf polygon feature for the census tract, with its coordinates and attributes
        censusTractsFeature = turf.polygon(coordinates, props);
        //console.log(censusTractsFeature);            

        // Get the centroid of the census tract
        var censusTractsCentroidFeature = turf.centroid(censusTractsFeature, props);

        // Push the current census tract centroid into an array
        censusTractsArray.push(censusTractsCentroidFeature);

    });

    // Create a turf feature collection from the array of census tract centroid features
    censusTractCentroidsTurf = turf.featureCollection(censusTractsArray);
    //console.log("Census Tract Centroids Feature Collection:");
    //console.log(features);

} // end interpolateCancerRates()


// Build a Turf feature collection from the well points
// Call the interpolateNitrateRates() method to interpolate the nitrate concentrations to hexbins
// Interpolate the nitrate concentrations from the well points into a hexbin surface (http://turfjs.org/docs#interpolate)
function interpolateNitrateRates(distanceDecayCoefficient, hexbinArea) {

    // Remove any previous features from the layer group    
    if (nitrateRatesIDWLayerGroup !== undefined) {
        nitrateRatesIDWLayerGroup.clearLayers();
    }

    // Loop through each feature
    wellPoints.eachLayer(function (layer) {

        // Build a Turf feature collection from the well points

        // Create shorthand variable to access the layer properties and coordinates
        var props = layer.feature.properties;
        var coordinates = layer.feature.geometry.coordinates;

        // Create a turf point feature for the well point, with its coordinates and attributes
        wellPointsFeature = turf.point(coordinates, props);
        //console.log(wellPointsFeature);

        // Push the current well point feature into an array
        wellPointsArray.push(wellPointsFeature);

        //            // Buffer the well points by 5 miles
        //            var buffer = turf.buffer(wellPointsFeature, 5, {
        //                units: 'miles'
        //            });
        //
        //            // Convert the buffers to a Leaflet GeoJson layer and add it to the map
        //            L.geoJson(buffer).addTo(map);

    });

    // Create a turf feature collection from the array of well point features
    wellPointsFeatureCollection = turf.featureCollection(wellPointsArray);
    //console.log("Well Points Feature Collection:");
    //console.log(features);

    //        // Get the center point of the well point features
    //        var center = turf.center(features);
    //        console.log(center);

    // Set options for the well point interpolation
    var options = {
        gridType: 'hex', // use hexbins as the grid type
        property: 'nitr_ran', // interpolate values from the nitrate concentrations
        units: 'kilometers', // hexbin size units
        weight: distanceDecayCoefficient // distance decay coefficient, q
    };

    // Interpolate the well point features using the grid size from the hexbinArea variable and the options just specified
    nitrateRatesHexbinsTurf = turf.interpolate(wellPointsFeatureCollection, hexbinArea, options);

    // Loop through each hexbin and get its interpolated nitrate concentration
    for (var hexbin in nitrateRatesHexbinsTurf.features) {
        var interpolatedNitrateRate = nitrateRatesHexbinsTurf.features[hexbin].properties.nitr_ran;
        interpolatedNitrateRatesArray.push(interpolatedNitrateRate);
        //console.log(nitrateRatesHexbinsTurf.features[hexbin].properties.nitr_ran);
    }

    // Convert the hexbins to a Leaflet GeoJson layer and add it to the map
    nitrateRatesHexbins = L.geoJson(nitrateRatesHexbinsTurf, {

        // Style the nitrate concentration hexbins
        style: function (feature) {
            return {
                color: '#585858', // Stroke Color
                weight: 0.5, // Stroke Weight
                fillOpacity: 0.75, // Override the default fill opacity
                opacity: 0.5 // Border opacity
            };
        }

    }).addTo(nitrateRatesIDWLayerGroup);

    // Get the class breaks based on the ckmeans classification method
    var breaks = getNitrateRateClassBreaks(nitrateRatesHexbins);

    // Loop through each feature
    nitrateRatesHexbins.eachLayer(function (layer) {

        // Set its color based on the cancer rate
        layer.setStyle({
            fillColor: getNitrateRateColor(layer.feature.properties.nitr_ran, breaks)
        });

        // Build the popup for the hexbin
        var popup = "<b>Nitrate Concentration: </b>" + layer.feature.properties.nitr_ran.toFixed(2) + " ppm";

        // Bind the popup to the hexbin
        layer.bindPopup(popup);

    });

    // Move the hexbins to the front
    nitrateRatesHexbins.bringToFront();

    // Draw the legend for the nitrate rate hexbins
    drawNitrateRatesLegend(breaks);

} // end interpolateNitrateRates()


// Join the cancer rates from a grid of interpolated cancer rate to the nitrate rate hexbins
function joinCancerRatesToNitrateInterpolation(distanceDecayCoefficient, hexbinArea) {
    
    // Remove any previous features from the layer group    
    if (collectedFeaturesLayerGroup !== undefined) {
        collectedFeaturesLayerGroup.clearLayers();
    }    
    
    // Set options for the cancer rate interpolation by grid points
    var gridOptions = {
        gridType: 'point', // use points as the grid type, required to use the collect function
        property: 'canrate', // interpolate values from the cancer rates
        units: 'kilometers', // hexbin size units
        weight: distanceDecayCoefficient // distance decay coefficient, q
    };    
    
    // Interpolate the cancer rates centroid into a surface of grid points (http://turfjs.org/docs#interpolate)
    cancerRatesGridPointsTurf = turf.interpolate(censusTractCentroidsTurf, hexbinArea, gridOptions);        
    
    // Use the collect function to join the cancer rates from the cancer rate grid points to the nitrate rate hexbins
    var collected = turf.collect(nitrateRatesHexbinsTurf, cancerRatesGridPointsTurf, 'canrate', 'values');
    
    console.log("Collected Features:");    
    console.log(collected);    

    // Loop through each of the collected hexbins
    for (var i in collected.features) {
        
        // Get the array of cancer rates for the current hexbin
        var canrateArray = collected.features[i].properties.values;
        
        // Loop through each feature in the cancer rates array and sum them
        var canrateArraySum = 0;
        for (var j in canrateArray) {
            
            if (canrateArray.length > 0) {
                canrateArraySum += parseFloat(canrateArray[j]);                
            }

        }
        
        // Get the average cancer rate
        var canrateArrayAvg = canrateArraySum/canrateArray.length;
        //console.log("Average: " + canrateArrayAvg);
        
        // Add the average cancer rate to the canrate property of the current hexbin
        if (canrateArrayAvg !== undefined) {
            collected.features[i].properties['canrate'] = canrateArrayAvg;            
        }
        else {
            collected.features[i].properties['canrate'] = "";
        }

    }
    
    // Convert the census tract centroids to a Leaflet GeoJson layer and add it to the map
    collectedFeatures = L.geoJson(collected, {

        // Style the census tract centroids
        style: function (feature) {
            return {
                color: '#585858', // Stroke Color
                weight: 0.5, // Stroke Weight
                fillOpacity: 0.75, // Override the default fill opacity
                opacity: 0.5 // Border opacity
            };
        }

    }).addTo(collectedFeaturesLayerGroup);    

    
    // Get the class breaks based on the ckmeans classification method
    var breaks = getCancerRateClassBreaks(collectedFeatures);

    // Loop through each feature
    collectedFeatures.eachLayer(function (layer) {

        // Set its color based on the cancer rate
        layer.setStyle({
            fillColor: getCancerRateColor(layer.feature.properties.canrate, breaks)
        });

        // Build the popup for the hexbin
        var popup = "<b>Cancer Rate: </b>" + (layer.feature.properties.canrate * 100).toFixed(2).toLocaleString() + "% of census tract population";

        // Bind the popup to the hexbin
        layer.bindPopup(popup);

    });

    // Move the hexbins to the front
    collectedFeatures.bringToFront();

    // Draw the legend for the cancer rate hexbins
    drawCancerRatesLegend(breaks);    

    //console.log("Nitrate Rate Hexbins Turf Feature Collection:");
    //console.log(nitrateRatesHexbinsTurf);
    //console.log("Collected Feature Collection");
    //console.log(collected);    

} // end joinCancerRatesToNitrateInterpolation()