// DECLARE MAP IN GLOBAL SCOPE
var map;

// DECLARE DEFAULT OPACITY IN GLOBAL SCOPE
var currentOpacity = 1;

var sheetBoundaries;
var currentAddress;
var searchResultMarker;

// DECLARE GLOBAL VARIABLES FOR GEOCODING
var arcgisOnline = L.esri.Geocoding.arcgisOnlineProvider();
var geocodeService = L.esri.Geocoding.geocodeService();


// DECLARE BASEMAPS IN GLOBAL SCOPE

// GREY BASEMAP
var Esri_WorldGrayCanvas = L.tileLayer('https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 16
});

// GREY BASEMAP LABELS
var Esri_WorldGrayReference = L.tileLayer('https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 16
});


// SET THE MAP OPTIONS
var mapOptions = {
    center: [44.437778, -90.130186], // centered in central Wisconsin
    zoom: 7,
    minZoom: 7,
    maxZoom: 17,
    maxBounds: L.latLngBounds([40.822448, -80.120168], [48.628936, -100.325876]), // panning bounds so the user doesn't pan too far away from Wisconsin
    bounceAtZoomLimits: false // Set it to false if you don't want the map to zoom beyond min/max zoom and then bounce back when pinch-zooming
    //layers: [Esri_WorldGrayCanvas, sanborn], // Set the layers to build into the layer control
}


// CREATE A NEW LEAFLET MAP WITH THE MAP OPTIONS
var map = L.map('map', mapOptions);


// ADD THE ZOOM CONTROL IN THE BOTTOM RIGHT CORNER
map.zoomControl.setPosition('bottomright');


// SET THE BASEMAP
// ONLY INCULDE ONE BASEMAP SO IT IS NOT PART OF THE LAYER LIST
var baseMaps = {
    "Grayscale": Esri_WorldGrayCanvas
};

// SET THE OVERLAYS
//var overlayMaps = {
//    "1910 Sanborn Maps": sanborn
//    // We can add the landmarks layer here when it is ready
//};

// ADD THE LAYER CONTROL TO THE MAP
//var toggleControls = L.control.layers(baseMaps, overlayMaps,
//    {
//    collapsed: false // Keep the layer list open
//}).addTo(map);


/********************************************************************************/
/* CALL GET DATA FUNCTION */
getData(map);


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
        }).addTo(map);
        
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
            pointToLayer: function(feature, latlng) {
                return L.circleMarker(latlng, {
                    fillColor: 'gray',
                    fillOpacity: 1,
                    color: 'black',
                    weight: 1.25,
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
        }).addTo(map);
        
        //wellPoints.bringToFront();


    });
 
	

    // BRACKET CLOSING THE GETDATA FUNCTION
}