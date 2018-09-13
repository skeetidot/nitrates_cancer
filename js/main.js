/* Define Global Variables */

// Esri basemap tiles
var Esri_WorldGrayCanvas = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
});

var Esri_WorldGrayReference = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
});


// Initialize layers in global scope, to include them in the layer list
var wellPointsLayerGroup = L.layerGroup(),
    censusTractsLayerGroup = L.layerGroup(),
    nitrateRatesIDWLayerGroup = L.layerGroup(),
    cancerRatesIDWLayerGroup = L.layerGroup();


// Initialize global variables for data layers
var censusTracts;


// Initialize arrays to store the well points, census tracts, interpolated nitrate rates, and interpolated cancer rates
var wellPointsArray = [],
    censusTractsArray = [],
    interpolatedNitrateRatesArray = [],
    interpolatedCancerRatesArray = [];


// Set the map options
var mapOptions = {
    center: [44.437778, -90.130186], // centered in central Wisconsin
    zoom: 7,
    minZoom: 7,
    maxZoom: 17,
    maxBounds: L.latLngBounds([40.822448, -80.120168], [48.628936, -100.325876]), // panning bounds so the user doesn't pan too far away from Wisconsin
    bounceAtZoomLimits: false, // Set it to false if you don't want the map to zoom beyond min/max zoom and then bounce back when pinch-zooming
    layers: [Esri_WorldGrayCanvas, wellPointsLayerGroup, censusTractsLayerGroup, nitrateRatesIDWLayerGroup, cancerRatesIDWLayerGroup] // Set the layers to build into the layer control
};


// Create a new Leaflet map with the map options
var map = L.map('map', mapOptions);


// Add the zoom control in the top left corner
map.zoomControl.setPosition('topleft');


// Add the basemaps
map.addLayer(Esri_WorldGrayCanvas);
map.addLayer(Esri_WorldGrayReference);


// Build the layer list
buildLayerList();


// Use JQuery's getJSON() method to load the census tract and cancer rate data asynchronously
$.getJSON("data/cancer_tracts.json", function (data) {

    // Create a Leaflet GeoJson layer for the census tracts and add it to the census tracts layer group
    censusTracts = L.geoJson(data, {

        // Create a style for the census tracts
        style: function (feature) {
            return {
                color: '#585858', // set stroke color
                weight: 0.5, // set stroke weight
                fillOpacity: .5, // override the default fill opacity
                opacity: 1 // border opacity
            };
        },

        // Loop through each feature and create a popup
        onEachFeature: function (feature, layer) {
            //console.log(layer);
            layer.on('click', function (e) {
                //buildCensusTractsPopupContent(feature, layer, e);
            });
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
                color: 'whitesmoke',
                weight: .25,
                opacity: 1,
                radius: 2.5
            });
        },

        // LOOP THROUGH EACH FEATURE AND CREATE A POPUP
        onEachFeature: function (feature, layer) {
            //console.log(layer);
            layer.on('click', function (e) {
                //buildPopupContent(feature, layer, e);
            });
        }
    }).addTo(wellPointsLayerGroup);


    /********************************************************************************/
    // BUILD A TURF FEATURE COLLECTION FROM THE WELL POINTS

    // Loop through each feature in the wellPoints GeoJson layer
    wellPoints.eachLayer(function (layer) {

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
    var features = turf.featureCollection(wellPointsArray);
    //console.log("Well Points Feature Collection:");
    //console.log(features);

    //        // Get the center point of the well point features
    //        var center = turf.center(features);
    //        console.log(center);

    // Call the function to interpolate nitrate rates and generate a hexbin surface
    interpolateNitrateRates(features);

});

// Draw census tracts, symbolized by cancer rate
// Get the class breaks based on the ckmeans classification method
// Loop through each county and:
// 1. Set its color based on which cluster its normalized attribute falls into
// 2. Build and bind its popup
// Draw the legend      
function drawCensusTracts() {

    // Get the class breaks based on the ckmeans classification method
    var breaks = getClassBreaks();

    // Loop through each feature
    censusTracts.eachLayer(function (layer) {

        // Set its color based on the cancer rate
        layer.setStyle({
            fillColor: getColor(layer.feature.properties.canrate, breaks)
        });

        //console.log(getColor(layer.feature.properties.canrate, breaks));

        //console.log(layer);

        // Build the popup for the census tract
        var popup = "<b>Tract Name</b><br>" + "Cancer Rate: " + layer.feature.properties.canrate;

        // Bind the popup to the county
        layer.bindPopup(popup);

    });

    // Draw the legend for the census tracts
    drawLegend(breaks);

    // Build a Turf feature collection from the census tracts
    // Loop through each feature in the censusTracts GeoJson layer
    censusTracts.eachLayer(function (layer) {

        // Create shorthand variable to access the layer properties and coordinates
        var props = layer.feature.properties;
        var coordinates = layer.feature.geometry.coordinates;

        //            console.log("Census Tract Coordinates:")
        //            console.log(coordinates);

        // Create a turf polygon feature for the census tract, with its coordinates and attributes
        censusTractsFeature = turf.polygon(coordinates, props);
        //console.log(censusTractsFeature);            

        // Get the centroid of the census tract
        var censusTractsFeatureCentroid = turf.centroid(censusTractsFeature, props);
        //console.log(censusTractsFeatureCentroid);            

        // Push the current census tract centroid into an array
        censusTractsArray.push(censusTractsFeatureCentroid);

        //            // Buffer the well points by 5 miles
        //            var buffer = turf.buffer(wellPointsFeature, 5, {
        //                units: 'miles'
        //            });
        //
        //            // Convert the buffers to a Leaflet GeoJson layer and add it to the map
        //            L.geoJson(buffer).addTo(map);


    });

    // Create a turf feature collection from the array of census tract centroid features
    var features = turf.featureCollection(censusTractsArray);
    //console.log("Census Tract Centroids Feature Collection:");
    //console.log(features);

    //        // Get the center point of the well point features
    //        var center = turf.center(censusTractsFeature);
    //        console.log(center);


    // Call the function to interpolate cancer rates and generate a hexbin surface
    interpolateCancerRates(features);

    //console.log(censusTracts);

    // Move the census tracts to the bottom of the layer order
    censusTracts.bringToBack();

} // end drawCensusTracts()

// Establish classification breaks
function getClassBreaks() {

    // Create an empty array to store the cancer rates
    var values = [];

    // Loop through each census tract to get its cancer rate
    censusTracts.eachLayer(function (layer) {
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

} // end getClassBreaks()       

// Set the color of the features depending on which cluster the value falls in
function getColor(d, breaks) {

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
        return '#2b8cbe'

        // If the data value <= the upper value of the fifth cluster  
    } else if (d <= breaks[4][1]) {
        return '#045a8d'

    }
} // end getColor()

// Create the legend        
function drawLegend(breaks) {

    // Create a new Leaflet control object, and position it top left
    var legend = L.control({
        position: 'bottomleft'
    });

    // When the legend is added to the map
    legend.onAdd = function () {

        // Create a new HTML <div> element and give it a class name of "legend"
        var div = L.DomUtil.create('div', 'legend');

        // First append an <h3> heading tag to the div holding the current attribute and norm values (i.e., the mapped phenomena)
        div.innerHTML = "<h3><b>Cancer Rate</b></h3>";

        // For each of our breaks
        for (var i = 0; i < breaks.length; i++) {

            // Determine the color associated with each break value, including the lower range value
            var color = getColor(breaks[i][0], breaks);

            // Concatenate a <span> tag styled with the color and the range values of that class and include a label with the low and high ends of that class range
            div.innerHTML +=
                '<span style="background:' + color + '"></span> ' +
                '<label>' + (breaks[i][0]).toLocaleString() + ' &mdash; ' +
                (breaks[i][1]).toLocaleString() + '</label>';

        }

        // Return the populated legend div to be added to the map   
        return div;

    }; // end onAdd method

    // Add the legend to the map
    legend.addTo(map);

} // end drawLegend)()

// Build the layer list
function buildLayerList() {

    // Set the basemap
    // Only include one basemap so it is not part of the layer list
    var baseMaps = {
        "Grayscale": Esri_WorldGrayCanvas
    };

    // Set the overlays
    var overlays = {
        "Well Points": wellPointsLayerGroup,
        "Census Tracts": censusTractsLayerGroup,
        "Nitrate Concentrations": nitrateRatesIDWLayerGroup,
        "Cancer Rates": cancerRatesIDWLayerGroup
        // Add other layers here when they are ready
    };

    // Add the layer control to the map
    var layerList = L.control.layers(baseMaps, overlays, {
        collapsed: false, // Keep the layer list open
        autoZIndex: true, // Assign zIndexes in increasing order to all of its layers so that the order is preserved when switching them on/off
        hideSingleBase: true // Hide the base layers section when there is only one layer
    }).addTo(map);
}

// Interpolate the cancer rates from the census tracts into a hexbin surface (http://turfjs.org/docs#interpolate)
function interpolateCancerRates(features) {

    // Set options for the cancer rate interpolation
    var options = {
        gridType: 'hex', // use hexbins as the grid type
        property: 'canrate', // interpolate values from the cancer rates
        units: 'kilometers', // hexbin size units
        weight: 2 // distance decay coefficient, q
    };

    // Interpolate the census tract features using a 10 sq km grid size and the options just specified
    var cancerRatesHexbins = turf.interpolate(features, 10, options);
    //console.log(nitrateRatesHexbins);

    // Loop through each hexbin and get its interpolated cancer rate
    for (var hexbin in cancerRatesHexbins.features) {
        var interpolatedCancerRate = cancerRatesHexbins.features[hexbin].properties.canrate;
        interpolatedCancerRatesArray.push(interpolatedCancerRate);
        //console.log(cancerRatesHexbins.features[hexbin].properties.canrate);

        // Use Simple Statistics to symbolize hexbins by natural breaks (jenks)
    }

    console.log("Cancer Rate Hexbins:");
    console.log(cancerRatesHexbins);


    // Convert the hexbins to a Leaflet GeoJson layer and add it to the map
    L.geoJson(cancerRatesHexbins, {

        // Style the cancer rate hexbins
        style: function (feature) {
            return {
                color: '#585858', // Stroke Color
                weight: 0.5, // Stroke Weight
                fillOpacity: 0, // Override the default fill opacity
                opacity: .5 // Border opacity
            };
        },

        // Loop through each feature and create a popup
//        onEachFeature: function (feature, layer) {
//            //console.log(layer);
//            layer.on('click', function (e) {
//                //buildPopupContent(feature, layer, e);
//            });
//        }

    }).addTo(cancerRatesIDWLayerGroup);  
}

// Interpolate the nitrate concentrations from the well points into a hexbin surface (http://turfjs.org/docs#interpolate)
function interpolateNitrateRates(features) {

    // Set options for the well point interpolation
    var options = {
        gridType: 'hex', // use hexbins as the grid type
        property: 'nitr_ran', // interpolate values from the nitrate concentrations
        units: 'kilometers', // hexbin size units
        weight: 2 // distance decay coefficient, q
    };

    // Interpolate the well point features using a 10 sq km grid size and the options just specified
    var nitrateRatesHexbins = turf.interpolate(features, 10, options);

    // Loop through each hexbin and get its interpolated nitrate concentration
    for (var hexbin in nitrateRatesHexbins.features) {
        var interpolatedNitrateRate = nitrateRatesHexbins.features[hexbin].properties.nitr_ran;
        interpolatedNitrateRatesArray.push(interpolatedNitrateRate);
        //console.log(nitrateRatesHexbins.features[hexbin].properties.nitr_ran);

        // Use Simple Statistics to symbolize hexbins by natural breaks (jenks)
    }

    console.log("Nitrate Rate Hexbins:");
    console.log(nitrateRatesHexbins);


    // Convert the hexbins to a Leaflet GeoJson layer and add it to the map
    L.geoJson(nitrateRatesHexbins, {

        // Style the nitrate concentration hexbins
        style: function (feature) {
            return {
                color: '#585858', // Stroke Color
                weight: 0.5, // Stroke Weight
                fillOpacity: 0, // Override the default fill opacity
                opacity: .5 // Border opacity
            };
        },

        // Loop through each feature and create a popup
//        onEachFeature: function (feature, layer) {
//            //console.log(layer);
//            layer.on('click', function (e) {
//                //buildPopupContent(feature, layer, e);
//            });
//        }

    }).addTo(nitrateRatesIDWLayerGroup);
}