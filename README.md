# Spatial Analysis of Well Nitrates and Cancer Occurrences in Wisconsin
High nitrate concentrations in drinking water are a health hazard. Recently, a possible cancer risk in adults from nitrate (and nitrite) has emerged, but the magnitude of the risk is unknown.

This map uses Inverse Distance Weighted (IDW) spatial interpolation and Ordinary Least Squares (OLS) linear regression to examine the relationship, if any, between nitrate concentrations in water wells and cancer rates in Wisconsin.

To examine a possible correlation between nitrate concentrations and cancer rates, select a distance decay coefficient (q) to use for the spatial interpolation and the hexbin size (in square kilometers).

The distance decay coefficient (q) is an exponent in the formula which determines how quickly the weight of a sampled value will decrease the further away it is from the unsampled location. The larger the distance decay coefficient, the quicker the weight of a sampled value decreases as its distance from the unsampled location increases. The distance decay coefficient can be 0 or higher, but it is typically between 1.5 and 2.5.

The hexbin size represents the area of the hexbin in square kilometers and determines the level of detail to use for the analysis. Smaller hexbins are more detailed, but take longer to process.

View a demo of the application at https://www.youtube.com/watch?v=GV7zcDyoy7U&t=75s.