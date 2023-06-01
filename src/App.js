import "./App.css";
import "@tomtom-international/web-sdk-maps/dist/maps.css";
import { useEffect, useRef, useState } from "react";
import * as tt from "@tomtom-international/web-sdk-maps";
import * as ttapi from "@tomtom-international/web-sdk-services";

const App = () => {
  const apiKey = process.env.REACT_APP_TOM_TOM_API_KEY;
  const mapElement = useRef();
  const [map, setMap] = useState({});
  const [longitude, setLongitude] = useState(36.2304);
  const [latitude, setLatitude] = useState(49.9935);
  const [routeLength, setRouteLength] = useState(0);
  const [notification, setNotification] = useState(null);
  const gasStations = []; // Global array to store gas station points
  let fuelLeftForMeters = 500; // Fuel left in meters

  const convertToPoints = (lngLat) => {
    return {
      point: {
        longitude: lngLat.lng,
        latitude: lngLat.lat,
      },
    };
  };

  const drawRoute = (geoJson, map) => {
    if (map.getLayer("route")) {
      map.removeLayer("route");
      map.removeSource("route");
    }
    map.addLayer({
      id: "route",
      type: "line",
      source: {
        type: "geojson",
        data: geoJson,
      },
      paint: {
        "line-color": "#4a90e2",
        "line-width": 6,
      },
    });

    // Calculate the route length
    const routeFeatures = geoJson.features;
    if (routeFeatures.length > 0) {
      const distanceInMeters =
        routeFeatures[0].properties.summary.lengthInMeters;
      setRouteLength(distanceInMeters);
    }
  };

  // Add a gas marker to the map

  const addRandomGasStations = (map) => {
    const minLng = map.getBounds()._sw.lng; // Minimum longitude value based on current map bounds
    const maxLng = map.getBounds()._ne.lng; // Maximum longitude value based on current map bounds
    const minLat = map.getBounds()._sw.lat; // Minimum latitude value based on current map bounds
    const maxLat = map.getBounds()._ne.lat; // Maximum latitude value based on current map bounds
    const numberOfGasStations = 10; // Number of random gas stations to add

    for (let i = 0; i < numberOfGasStations; i++) {
      const lng = Math.random() * (maxLng - minLng) + minLng;
      const lat = Math.random() * (maxLat - minLat) + minLat;

      gasStations.push({ lng, lat }); // Add gas station points to the global array

      const element = document.createElement("div");
      element.className = "marker-gas-station";

      new tt.Marker({
        element: element,
      })
        .setLngLat([lng, lat])
        .addTo(map);
    }
  };

  const addDeliveryMarker = (lngLat, map) => {
    const element = document.createElement("div");
    element.className = "marker-delivery";
    new tt.Marker({
      element: element,
    })
      .setLngLat([lngLat.lng, lngLat.lat])
      .addTo(map);
  };

  useEffect(() => {
    const origin = {
      lng: longitude,
      lat: latitude,
    };
    const destinations = [];

    let map = tt.map({
      key: apiKey,
      container: mapElement.current,
      center: [longitude, latitude],
      zoom: 14,
      stylesVisibility: {
        trafficIncidents: true,
        trafficFlow: true,
      },
    });

    setMap(map);
    const addMarker = () => {
      const popupOffset = {
        bottom: [0, -25],
      };
      const popup = new tt.Popup({ offset: popupOffset }).setHTML(
        "this is you"
      );
      const element = document.createElement("div");
      element.className = "marker";

      const marker = new tt.Marker({
        draggable: true,
        element: element,
      })
        .setLngLat([longitude, latitude])
        .addTo(map);

      marker.on("dragend", () => {
        const lngLat = marker.getLngLat();
        setLongitude(lngLat.lng);
        setLatitude(lngLat.lat);
      });

      marker.setPopup(popup).togglePopup();
    };

    addMarker();

    const sortDestinations = (locations) => {
      const pointsForDestinations = locations.map((destination) => {
        return convertToPoints(destination);
      });
      const callParams = {
        key: apiKey,
        destinations: pointsForDestinations,
        origins: [convertToPoints(origin)],
      };
      return new Promise((resolve, reject) => {
        ttapi.services.matrixRouting(callParams).then((matrixAPIResults) => {
          const results = matrixAPIResults.matrix[0];
          const resultsArray = results.map((result, index) => {
            return {
              location: locations[index],
              drivingtime: result.response.summary?.travelTimeInSeconds || 0,
            };
          });
          resultsArray.sort((a, b) => {
            return a.drivingtime - b.drivingtime;
          });
          const sortedLocations = resultsArray.map((result) => {
            return result.location;
          });
          resolve(sortedLocations);
        });
      });
    };

    // const recalculateRoutes = () => {
    //   sortDestinations(destinations).then((sorted) => {
    //     sorted.unshift(origin);

    //     ttapi.services
    //       .calculateRoute({
    //         key: apiKey,
    //         locations: sorted,
    //       })
    //       .then((routeData) => {
    //         const geojson = routeData.toGeoJson();
    //         drawRoute(geojson, map);
    //       });
    //   });
    // };

    // distance

    const calculateDistance = (coord1, coord2) => {
      const toRad = (value) => (value * Math.PI) / 180;
      const earthRadius = 6371; // Radius of the Earth in kilometers

      const lat1 = coord1.lat;
      const lon1 = coord1.lng;
      const lat2 = coord2.lat;
      const lon2 = coord2.lng;

      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
          Math.cos(toRad(lat2)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = earthRadius * c;

      return distance;
    };

    const recalculateRoutes = () => {
      sortDestinations(destinations).then((sorted) => {
        sorted.unshift(origin);

        ttapi.services
          .calculateRoute({
            key: apiKey,
            locations: sorted,
          })
          .then((routeData) => {
            const geojson = routeData.toGeoJson();
            drawRoute(geojson, map);

            const distanceInMeters =
              geojson.features[0]?.properties?.summary?.lengthInMeters;
            if (distanceInMeters > fuelLeftForMeters) {
              const currentLocation = sorted[0]; // Current location is the first element in the sorted array
              let nearestGasStation = null;
              let minDistance = Infinity;

              // Find the nearest gas station
              for (const gasStation of gasStations) {
                const distance = calculateDistance(currentLocation, gasStation);
                if (distance < minDistance) {
                  minDistance = distance;
                  nearestGasStation = gasStation;
                }
              }

              if (nearestGasStation) {
                const nearestGasStationPoints =
                  convertToPoints(nearestGasStation); // Convert nearest gas station to points format
                sorted[1] = nearestGasStationPoints.point; // Use the "point" property of the converted gas station
                ttapi.services
                  .calculateRoute({
                    key: apiKey,
                    locations: sorted,
                  })
                  .then((routeData) => {
                    const geojson = routeData.toGeoJson();
                    drawRoute(geojson, map);
                  });
              } else {
                // Notify user that there is no nearby gas station within the fuel range
                setNotification(
                  "No gas station is available within the fuel range."
                );
              }
            }
          });
      });
    };

    map.on("load", () => {
      addRandomGasStations(map);
    });

    map.on("click", (e) => {
      destinations.push(e.lngLat);
      addDeliveryMarker(e.lngLat, map);
      recalculateRoutes();
    });

    return () => map.remove();
  }, [longitude, latitude]);

  return (
    <>
      {map && (
        <div className="app">
          <div ref={mapElement} className="map-container" />
          <div className="search-bar">
            <h1>Where to</h1>
            <input
              type="text"
              id="longitude"
              className="longitude"
              placeholder="Set longitude"
              onChange={(e) => setLongitude(e.target.value)}
            />
            <input
              type="text"
              id="latitude"
              className="latitude"
              placeholder="Set latitude"
              onChange={(e) => setLatitude(e.target.value)}
            />
          </div>
          <div>Route Length: {routeLength} meters</div>
          {notification && <div className="notification">{notification}</div>}
        </div>
      )}
    </>
  );
};

export default App;
