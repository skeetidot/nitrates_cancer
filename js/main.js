// Declare the map in global scope
var map;


// Declare basemaps in global scope

// Esri Light Gray Canvas Basemap
var Esri_WorldGrayCanvas = L.tileLayer('https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 16
});

// Esri Light Gray Canvas Basemap Labels
var Esri_WorldGrayReference = L.tileLayer('https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 16
});


// Initialize layers in global scope
var wellPointsLayerGroup = L.layerGroup();
var censusTractsLayerGroup = L.layerGroup();


// Initialize an array to store the well points
var wellPointsArray = [];


// Set the map options
var mapOptions = {
    center: [44.437778, -90.130186], // centered in central Wisconsin
    zoom: 7,
    minZoom: 7,
    maxZoom: 17,
    maxBounds: L.latLngBounds([40.822448, -80.120168], [48.628936, -100.325876]), // panning bounds so the user doesn't pan too far away from Wisconsin
    bounceAtZoomLimits: false, // Set it to false if you don't want the map to zoom beyond min/max zoom and then bounce back when pinch-zooming
    layers: [Esri_WorldGrayCanvas, wellPointsLayerGroup, censusTractsLayerGroup] // Set the layers to build into the layer control
}


// Create a new Leaflet map with the map options
var map = L.map('map', mapOptions);


// Add the zoom control in the top left corner
map.zoomControl.setPosition('topleft');


// Call the get data function to retrieve the data and place it on the map
getData(map);


// Call the build layer list function
buildLayerList();




/********************************************************************************/
// FUNCTION TO RETRIEVE DATA AND PLACE IT ON THE MAP (:
function getData(map) {


    // ADD THE BASEMAPS
    map.addLayer(Esri_WorldGrayCanvas);
    map.addLayer(Esri_WorldGrayReference);


    /********************************************************************************/
    // USE JQUERY'S GETJSON() METHOD TO LOAD THE CENSUS TRACT AND CANCER RATE DATA ASYNCHRONOUSLY
    $.getJSON("data/cancer_tracts.json", function (data) {

        // CREATE A LEAFLET GEOJSON LAYER FOR THE CENSUS TRACTS WITH POPUPS AND ADD TO THE MAP
        censusTracts = L.geoJson(data, {

            // CREATE STYLING FOR THE CENSUS TRACTS LAYER
            style: function (feature) {
                return {
                    color: '#585858', // Stroke Color
                    weight: 0.5, // Stroke Weight
                    fillOpacity: 0, // Override the default fill opacity
                    opacity: 1 // Border opacity
                };
            },

            // LOOP THROUGH EACH FEATURE AND CREATE A POPUP
            onEachFeature: function (feature, layer) {
                //console.log(layer);
                layer.on('click', function (e) {
                    buildPopupContent(feature, layer, e);
                });
            }
        }).addTo(censusTractsLayerGroup);

        //console.log(censusTracts);

        // Move the census tracts to the bottom of the layer order
        censusTracts.bringToBack();

    });


    /********************************************************************************/
    /* POPULATE THE POPUP USING ATTRIBUTES FROM THE GEOJSON BOUNDARY DATA */
    function buildPopupContent(feature, layer, e) {


        /********************************************************************************/
        /* GET THE FEATURES FROM THE GEOJSON AND ADD TO A POPUP */
        var cancerRate = "<div class= 'item-key'><b>Cancer Rate:</b></div> <div class='item-value'>" + feature.properties['canrate'] + "</div>";

        /* PUSH INFO TO POPUP USING RESPONSIVE POPUP PLUGIN SO THAT POPUPS ARE CENTERED ON MOBILE
        EVALUATE EFFICACY OF THIS PLUGIN -- IS THERE SOMETHING MORE EFFECTIVE OUT THERE? */
        var popup = cancerRate;
        censusTracts.bindPopup(popup).openPopup();
    }


    /********************************************************************************/
    // USE JQUERY'S GETJSON() METHOD TO LOAD THE WELL POINTS AND NITRATE RATE DATA ASYNCHRONOUSLY
    $.getJSON("data/well_nitrate.json", function (data) {

        // CREATE A LEAFLET GEOJSON LAYER FOR THE WELL POINTS WITH POPUPS AND ADD TO THE MAP
        wellPoints = L.geoJson(data, {

            // CREATE STYLING FOR THE WELL POINTS LAYER
            pointToLayer: function (feature, latlng) {
                return L.circleMarker(latlng, {
                    fillColor: 'gray',
                    fillOpacity: 1,
                    color: 'black',
                    weight: 0.75,
                    opacity: 1,
                    radius: 3
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

            // Create a turf point feature from the lat/long array
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

        // Create a turf feature collection variable from the array of turf well points
        var features = turf.featureCollection(wellPointsArray);
        console.log(features);

        //        // Get the center point of the well point features
        //        var center = turf.center(features);
        //        console.log(center);

        // Call the function to interpolate nitrate rates and generate a hexbin surface
        interpolateNitrateRates(features);

    });


}
// End of the getData function


// Function to build the layer list
function buildLayerList() {

    // Set the basemap
    // Only include one basemap so it is not part of the layer list
    var baseMaps = {
        "Grayscale": Esri_WorldGrayCanvas
    };

    // Set the overlays
    var overlays = {
        "Well Points": wellPointsLayerGroup,
        "Census Tracts": censusTractsLayerGroup
        // Add other layers here when they are ready
    };

    // Add the layer control to the map
    var layerList = L.control.layers(baseMaps, overlays, {
        collapsed: false, // Keep the layer list open
        autoZIndex: true, // Assign zIndexes in increasing order to all of its layers so that the order is preserved when switching them on/off
        hideSingleBase: true // Hide the base layers section when there is only one layer
    }).addTo(map);
}

// Function to interpolate the nitrate rates from the well points into a hexbin surface (http://turfjs.org/docs#interpolate)
function interpolateNitrateRates(features) {
    
    // Set options for the well point interpolation
    var options = {
        gridType: 'hex',        // use hexbins as the grid type
        property: 'nitr_ran',   // interpolate values from the nitrate ranges
        units: 'kilometers',    // hexbin size units
        weight: 2               // distance decay coefficient, q
    };
    
    // Interpolate the well point features using a 10 sq km grid size and the options just specified
    var nitrateRatesHexbins = turf.interpolate(features, 10, options);
    //console.log(nitrateRatesHexbins);
    
    // Use Simple Statistics to symbolize hexbins by natural breaks (jenks)

    // Convert the hexbins to a Leaflet GeoJson layer and add it to the map
    L.geoJson(nitrateRatesHexbins).addTo(map);
}