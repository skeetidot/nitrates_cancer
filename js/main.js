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
    joinedCancerNitrateRatesIDWLayerGroup = L.layerGroup(),
    regressionResidualsLayerGroup = L.layerGroup();


// Initialize global variables for data layers
var censusTracts,
    wellPoints,
    nitrateRatesHexbins,
    collectedFeaturesHexbins,
    regressionFeaturesHexbins;


// Initialize global variables for the distance decay coefficient and hexbin size with default values
var distanceDecayCoefficient = 2,
    hexbinArea = 10; // 10 sq km


// Initialize arrays to store the well points, census tracts, interpolated nitrate rates, and interpolated cancer rates
var wellPointsArray = [],
    censusTractsArray = [],
    interpolatedNitrateRatesArray = [],
    interpolatedNitrateAndCancerRatesArray = [];


// Initialize global variables for the Turf.js feature collections
var censusTractCentroidsTurf,
    wellPointsFeatureCollection,
    nitrateRatesHexbinsTurf,
    cancerRatesGridPointsTurf,
    collectedFeaturesHexbinsTurf;


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
    layers: [Esri_WorldGrayCanvas, wellPointsLayerGroup, censusTractsLayerGroup, nitrateRatesIDWLayerGroup, joinedCancerNitrateRatesIDWLayerGroup, regressionResidualsLayerGroup] // Set the layers to build into the layer control
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

    // Loop through each feature, set its symbology, and build and bind its popup
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

    // Loop through each feature, set its symbology, and build and bind its popup
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
// 2. If Submit is clicked, get the distance decay coefficient and hexbin size and redraw the map with the interpolated and regression layers
// 3. If Reset is clicked, redraw the map with the original well points and census tracts
function getUIActions() {

    // Select the submit button
    var submit = $('#submitButton');

    // When the user clicks submit
    submit.on('click', function (e) {

        console.log("Clicked submit");

        // Call the submitParameters function to get the distance decay coefficient and hexbin size and redraw the map with the interpolated and regression layers
        submitParameters();

    });

    // Select the reset button
    var reset = $('#resetButton');

    // When the user clicks reset
    reset.on('click', function (e) {

        console.log("Clicked reset");

        // Call the resetParameters function to redraw the map with the original well points and census tracts
        resetParameters();

    });

}


// Get the distance decay coefficient and hexbin size and redraw the map with the interpolated and regression layers
function submitParameters() {

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

    if (collectedFeaturesHexbins !== undefined) {
        collectedFeaturesHexbins.remove();
    }

    if (regressionFeaturesHexbins !== undefined) {
        regressionFeaturesHexbins.remove();
    }

    // Use the JQuery select $() and val() methods to determine the value of the distance decay coefficient text box
    distanceDecayCoefficient = $('#distanceDecayCoefficient').val();
    distanceDecayCoefficient = parseFloat(distanceDecayCoefficient);

    // Use the JQuery select $() and val() methods to determine the value of the hexbin size text box
    hexbinArea = $('#hexbinArea').val();
    hexbinArea = parseFloat(hexbinArea);

    if (isNaN(hexbinArea) || hexbinArea < 6 || hexbinArea > 90) {
        window.alert("Enter a hexbin size between 6 and 90");
        $('#hexbinArea').val(10);
        resetParameters();
        console.log("invalid hexbin size");
        return;
    } else if (isNaN(distanceDecayCoefficient) || distanceDecayCoefficient < 0 || distanceDecayCoefficient > 100) {
        window.alert("Enter a distance decay coefficient between 0 and 100");
        $('#distanceDecayCoefficient').val(2);
        resetParameters();
        console.log("invalid distance decay coefficient");
        return;
    };

    console.log("Distance Decay Coefficient: " + distanceDecayCoefficient);
    console.log("Hexbin Area: " + hexbinArea);

    // Hide the current legend
    $('.legend').hide();

    // Remove the current layer list
    layerList.remove();

    // Set the overlays to include in the updated layer list
    overlays = {
        "Nitrate Concentrations": nitrateRatesIDWLayerGroup,
        "Cancer Rates": joinedCancerNitrateRatesIDWLayerGroup,
        "Regression Residuals": regressionResidualsLayerGroup
    };

    // Rebuild the layer list with the new list of overlays
    buildLayerList(overlays);

    // Call the function to interpolate nitrate rates and generate a hexbin surface
    interpolateNitrateRates(distanceDecayCoefficient, hexbinArea);

    // Call the function to join the hexbins, resulting in a hexbin surface with nitrate concentrations and cancer rates
    joinCancerRatesToNitrateInterpolation(distanceDecayCoefficient, hexbinArea);

} // end of submitParameters()


// Redraw the map with the original well points and census tracts
function resetParameters() {

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

    if (collectedFeaturesHexbins !== undefined) {
        collectedFeaturesHexbins.remove();
    }

    if (regressionFeaturesHexbins !== undefined) {
        regressionFeaturesHexbins.remove();
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
} // end of resetParameters


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

        // Create shorthand variables to access the layer properties and coordinates
        var props = layer.feature.properties;
        var coordinates = layer.feature.geometry.coordinates;

        // Create a turf point feature for the well point, with its coordinates and attributes
        wellPointsFeature = turf.point(coordinates, props);
        //console.log(wellPointsFeature);

        // Push the current well point feature into an array
        wellPointsArray.push(wellPointsFeature);

    });

    // Create a turf feature collection from the array of well point features
    wellPointsFeatureCollection = turf.featureCollection(wellPointsArray);
    //console.log("Well Points Feature Collection:");
    //console.log(features);

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

    // Loop through each feature, set its symbology, and build and bind its popup
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


// Build a Turf feature collection from census tract centroids
// Interpolate the cancer rates from the census tract centroids to grid points
// Join the cancer rates from a grid of interpolated cancer rate to the nitrate rate hexbins
function joinCancerRatesToNitrateInterpolation(distanceDecayCoefficient, hexbinArea) {

    // Remove any previous features from the layer group    
    if (joinedCancerNitrateRatesIDWLayerGroup !== undefined) {
        joinedCancerNitrateRatesIDWLayerGroup.clearLayers();
    }

    // Loop through each census tract feature and build a Turf feature collection from its centroid
    censusTracts.eachLayer(function (layer) {

        // Create shorthand variables to access the layer properties and coordinates
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
    var collectedFeaturesHexbinsTurf = turf.collect(nitrateRatesHexbinsTurf, cancerRatesGridPointsTurf, 'canrate', 'values');

    // Loop through each of the collected hexbins
    for (var i in collectedFeaturesHexbinsTurf.features) {

        // Get the array of cancer rates for the current hexbin
        var canrateArray = collectedFeaturesHexbinsTurf.features[i].properties.values;

        // Loop through each feature in the cancer rates array and sum them
        var canrateArraySum = 0;
        for (var j in canrateArray) {

            if (canrateArray.length > 0) {
                canrateArraySum += parseFloat(canrateArray[j]);
            }

        }

        // Get the average cancer rate
        var canrateArrayAvg = canrateArraySum / canrateArray.length;
        //console.log("Average: " + canrateArrayAvg);

        // Add the average cancer rate to the canrate property of the current hexbin
        if (canrateArrayAvg !== undefined) {
            collectedFeaturesHexbinsTurf.features[i].properties.canrate = canrateArrayAvg;
        } else {
            collectedFeaturesHexbinsTurf.features[i].properties.canrate = "";
        }

    }

    // Convert the collected hexbins to a Leaflet GeoJson layer and add it to the map
    collectedFeaturesHexbins = L.geoJson(collectedFeaturesHexbinsTurf, {

        // Set a default style for the collected hexbins
        style: function (feature) {
            return {
                color: '#585858', // Stroke Color
                weight: 0.5, // Stroke Weight
                fillOpacity: 0.75, // Override the default fill opacity
                opacity: 0.5 // Border opacity
            };
        }

    }).addTo(joinedCancerNitrateRatesIDWLayerGroup);

    // Get the class breaks based on the ckmeans classification method
    var breaks = getCancerRateClassBreaks(collectedFeaturesHexbins);

    // Loop through each feature, set its symbology, and build and bind its popup
    collectedFeaturesHexbins.eachLayer(function (layer) {

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
    collectedFeaturesHexbins.bringToFront();

    // Draw the legend for the cancer rate hexbins
    drawCancerRatesLegend(breaks);

    // Call the function to calculate linear regression
    calculateLinearRegression(collectedFeaturesHexbinsTurf, hexbinArea);

    //console.log("Nitrate Rate Hexbins Turf Feature Collection:");
    //console.log(nitrateRatesHexbinsTurf);
    //console.log("Collected Feature Collection");
    //console.log(collectedFeaturesHexbinsTurf);    

} // end joinCancerRatesToNitrateInterpolation()


// Calculate a linear regression where x is the nitrate concentration and y is the cancer rate
// Use the resulting slope (m) and y-intercept (b) to calculate the predicted cancer rate for each hexbin, and the residual (predicted rate - observed rate)
function calculateLinearRegression(collectedFeaturesHexbinsTurf, hexbinArea) {

    // Remove any previous features from the layer group    
    if (regressionResidualsLayerGroup !== undefined) {
        regressionResidualsLayerGroup.clearLayers();
    }


    // Loop through the hexbin layer with nitrate concentrations and cancer rates
    // Create a two-dimensional array of [x, y] pairs where x is the nitrate concentration and y is the cancer rate

    // Loop through each of the collected hexbins
    for (var i in collectedFeaturesHexbinsTurf.features) {

        // Create a shorthand variable to access the layer properties
        var props = collectedFeaturesHexbinsTurf.features[i].properties;

        // Create variables to store the interpolated nitrate concentration and cancer rate
        var interpolatedNitrateConcentration = props.nitr_ran;
        var interpolatedCancerRate = props.canrate;

        // Create an array for the current feature of [nitrate concentration, cancer rate]
        var currentNitrateAndCancerRates = [parseFloat(interpolatedNitrateConcentration), parseFloat(interpolatedCancerRate)];

        // Push the array of the current feature's nitrate concentration and cancer rate into an array
        interpolatedNitrateAndCancerRatesArray.push(currentNitrateAndCancerRates);

    }

    //console.log(interpolatedNitrateAndCancerRatesArray);

    // Run the linearRegression method from the Simple Statistics library to return an object containing the slope and intercept of the linear regression line
    // where nitrate concentration is the independent variable (x) and cancer rate is the dependent variable (y)
    // The object returns m (slope) and b (y-intercept) that can be used to predict cancer rates (y) using the equation, y = mx + b
    var regressionEquation = ss.linearRegression(interpolatedNitrateAndCancerRatesArray);
    console.log(regressionEquation);

    // Create variables for the slope and y-intercept
    var m = regressionEquation.m;
    var b = regressionEquation.b;

    // Loop through each of the collected hexbins
    for (var i in collectedFeaturesHexbinsTurf.features) {

        // Create a shorthand variable to access the layer properties
        var props = collectedFeaturesHexbinsTurf.features[i].properties;

        // Create variables to store the interpolated nitrate concentration and cancer rate
        var interpolatedNitrateConcentration = props.nitr_ran;
        var interpolatedCancerRate = props.canrate;

        // Use the slope and y-intercept from the regression equation to calculate the predicted cancer rate from the interpolate nitrate concentration
        var predictedCancerRate = m * (parseFloat(interpolatedNitrateConcentration)) + b;

        // Calculate the residual (predictedCancerRate - interpolatedCancerRate)
        var residual = predictedCancerRate - interpolatedCancerRate;

        collectedFeaturesHexbinsTurf.features[i].properties.predictedCancerRate = predictedCancerRate;
        //console.log(predictedCancerRate);

        collectedFeaturesHexbinsTurf.features[i].properties.residual = residual;
        //console.log(residual);

    }

    console.log(collectedFeaturesHexbinsTurf);

    // Convert the collected hexbins to a Leaflet GeoJson layer and add it to the map
    regressionFeaturesHexbins = L.geoJson(collectedFeaturesHexbinsTurf, {

        // Set a default style for the collected hexbins
        style: function (feature) {
            return {
                color: '#585858', // Stroke Color
                weight: 0.5, // Stroke Weight
                fillOpacity: 0.5, // Override the default fill opacity
                opacity: 0.5 // Border opacity
            };
        }

    }).addTo(regressionResidualsLayerGroup);

    // Get the class breaks based on the ckmeans classification method
    var breaks = getRegressionResidualClassBreaks(regressionFeaturesHexbins);
    
    // Loop through each feature, set its symbology, and build and bind its popup
    regressionFeaturesHexbins.eachLayer(function (layer) {

        // Set its color based on the cancer rate
        layer.setStyle({
            fillColor: getRegressionResidualColor(layer.feature.properties.residual, breaks)
        });

        // Build the popup for the hexbin
        var popup = "<b>Nitrate Concentration: </b>" + layer.feature.properties.nitr_ran.toFixed(2) + " ppm" + "<br/>" +
            "<b>Observed Cancer Rate: </b>" + (layer.feature.properties.canrate * 100).toFixed(2).toLocaleString() + "% of census tract population" + "<br/>" +
            "<b>Predicted Cancer Rate: </b>" + (layer.feature.properties.predictedCancerRate * 100).toFixed(2).toLocaleString() + "% of census tract population" + "<br/>";

        // Bind the popup to the hexbin
        layer.bindPopup(popup);

    });

    // Move the hexbins to the front
    regressionFeaturesHexbins.bringToFront();

    // Turn off the interpolation layers
    map.removeLayer(nitrateRatesIDWLayerGroup);
    map.removeLayer(joinedCancerNitrateRatesIDWLayerGroup);    

    // Draw the legend for the cancer rate hexbins
    drawRegressionResidualsLegend(breaks);

} // end calculateLinearRegression()


// Establish classification breaks for regression residuals
function getRegressionResidualClassBreaks(regressionFeaturesHexbins) {

    // Create an empty array to store the residuals
    var values = [];

    // Loop through each feature to get its residual
    regressionFeaturesHexbins.eachLayer(function (layer) {
        var value = layer.feature.properties.residual;

        // Push each cancer rate into the array
        values.push(value);
    });

    // Use Simple Statistics to get the standard deviation of the residuals
    var standardDeviation = ss.sampleStandardDeviation(values);
    
    // Create an array of the break points for -2, -1, 0, 1, and 2 standard deviations
    var breaks = [-2 * standardDeviation, -1 * standardDeviation, standardDeviation, 2 * standardDeviation];
    console.log(breaks);

    // Return the array of class breaks
    return breaks;

} // end getRegressionResidualClassBreaks()       


// Set the color of the features depending on which cluster the value falls in
function getRegressionResidualColor(d, breaks) {

    // If the data value <= the upper value of the first cluster
    if (d <= breaks[0]) {
        return '#ca0020';

        // If the data value <= the upper value of the second cluster    
    } else if (d <= breaks[1]) {
        return '#f4a582';

        // If the data value <= the upper value of the third cluster   
    } else if (d <= breaks[2]) {
        return '#f7f7f7';

        // If the data value <= the upper value of the fourth cluster   
    } else if (d <= breaks[3]) {
        return '#92c5de';

        // If the data value <= the upper value of the fifth cluster  
    } else if (d > breaks[3]) {
        return '#0571b0';

    }
} // end getRegressionResidualColor()


// Create the legend for regression residuals
function drawRegressionResidualsLegend(breaks) {

    // Create a new Leaflet control object, and position it bottom left
    var legend = L.control({
        position: 'bottomright'
    });

    // When the legend is added to the map
    legend.onAdd = function () {

        // Create a new HTML <div> element and give it a class name of "legend"
        var div = L.DomUtil.create('div', 'legend');

        // First append an <h3> heading tag to the div holding the current attribute
        div.innerHTML = "<h3><b>Residual (Predicted - Observed Cancer Rate)</b></h3>";

        var colorMoreThanMinus2StdDev = getRegressionResidualColor(breaks[0], breaks);
        var colorMinus2ToMinus1StdDev = getRegressionResidualColor(breaks[1], breaks);
        var colorMinus1To1StdDev = getRegressionResidualColor(breaks[2], breaks);
        var color1To2StdDev = getRegressionResidualColor(breaks[3], breaks);
        var colorMoreThan2StdDev = '#0571b0';

        div.innerHTML +=
            '<span style="background:' + colorMoreThanMinus2StdDev + '"></span> ' +
            '<label>< -2 Std. Dev. (Underprediction)</label>';
        
        div.innerHTML +=
            '<span style="background:' + colorMinus2ToMinus1StdDev + '"></span> ' +
            '<label>-2 Std. Dev. &mdash; -1 Std. Dev.</label>';
        
        div.innerHTML +=
            '<span style="background:' + colorMinus1To1StdDev + '"></span> ' +
            '<label>-1 Std. Dev. &mdash; 1 Std. Dev.</label>';
        
        div.innerHTML +=
            '<span style="background:' + color1To2StdDev + '"></span> ' +
            '<label>1 Std. Dev. &mdash; 2 Std. Dev.</label>';
        
        div.innerHTML +=
            '<span style="background:' + colorMoreThan2StdDev + '"></span> ' +
            '<label>> 2 Std. Dev. (Overprediction)</label>';             

        // Return the populated legend div to be added to the map   
        return div;

    }; // end onAdd method

    // Add the legend to the map
    legend.addTo(map);

} // end drawRegressionResidualsLegend()