import "./App.css";
import "@tomtom-international/web-sdk-maps/dist/maps.css";
import { useCallback, useEffect, useRef, useState } from "react";
import * as tt from "@tomtom-international/web-sdk-maps";
import * as ttapi from "@tomtom-international/web-sdk-services";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const apiKey = process.env.REACT_APP_TOM_TOM_API_KEY;
// const engineType = "diesel";
// const engineCapacity = 1.6;

export function App() {
  const mapElementRef = useRef(null);
  const mapRef = useMap({
    mapElementRef,
    longitude: 36.2304,
    latitude: 49.9935,
  });

  // useGenerateGasStations
  const [gasStations, setGasStations] = useState([]);
  useEffect(() => {
    const minLng = mapRef.current.getBounds()._sw.lng;
    const maxLng = mapRef.current.getBounds()._ne.lng;
    const minLat = mapRef.current.getBounds()._sw.lat;
    const maxLat = mapRef.current.getBounds()._ne.lat;

    const numberOfGasStations = 5;
    const _gasStations = [];

    for (let i = 0; i < numberOfGasStations; i++) {
      const lng = Math.random() * (maxLng - minLng) + minLng;
      const lat = Math.random() * (maxLat - minLat) + minLat;

      _gasStations.push({ lng, lat });
    }

    setGasStations(_gasStations);
  }, [setGasStations]);

  // useRenderGasStationMarkers
  useEffect(() => {
    gasStations.forEach((station) => {
      const element = document.createElement("div");
      element.className = "marker-gas-station";

      new tt.Marker({
        element,
      })
        .setLngLat([station.lng, station.lat])
        .addTo(mapRef.current);
    });
  }, [gasStations]);

  const [origin, setOrigin] = useState({ lng: 36.2304, lat: 49.9935 });
  const isOriginRendered = useRef(false);

  // useRenderOriginMarker
  useEffect(() => {
    if (isOriginRendered.current) {
      return;
    }

    const map = mapRef.current;

    const popup = new tt.Popup({
      offset: {
        bottom: [0, -25],
      },
    }).setHTML("this is you");

    const element = document.createElement("div");
    element.className = "marker";
    const marker = new tt.Marker({
      draggable: true,
      element: element,
    })
      .setLngLat([origin.lng, origin.lat])
      .addTo(map);

    marker.on("dragend", () => {
      const lngLat = marker.getLngLat();
      setOrigin({ lng: lngLat.lng, lat: lngLat.lat });
    });

    marker.setPopup(popup).togglePopup();
    isOriginRendered.current = true;

    return () => {
      isOriginRendered.current = false;
      marker.remove();
    };
  }, [origin, setOrigin]);

  const [destinations, setDestinations] = useState([]);

  // useCreateDestinationOnClick
  useEffect(() => {
    mapRef.current.on("click", (event) => {
      setDestinations((prevState) => prevState.concat(event.lngLat));
    });
  }, []);

  // useRenderDestinationMarkers
  useEffect(() => {
    const destinationMarkers = destinations.map((destination) => {
      const element = document.createElement("div");
      element.className = "marker-delivery";

      return new tt.Marker({
        element: element,
      })
        .setLngLat([destination.lng, destination.lat])
        .addTo(mapRef.current);
    });

    return () => {
      destinationMarkers.forEach((marker) => {
        marker.remove();
      });
    };
  }, [destinations]);

  const [route, setRoute] = useState(null); // geojson or null
  const lengthInMeters = getRouteLengthInMeters(route);

  const [form, setForm] = useState({});

  // useCreateRouteFromDestinations
  useEffect(() => {
    async function _perform() {
      if (destinations.length === 0) {
        return;
      }

      const sortedDestinations = await sortDestinations(destinations, origin);

      let _route = await ttapi.services.calculateRoute({
        key: apiKey,
        locations: [origin, ...sortedDestinations],
      });

      const routeLengthInMeters = getRouteLengthInMeters(_route.toGeoJson());
      const vehicleRangeInMeters =
        getVehicleRangeInMetersByFuelAmountAndConsumption(
          form.fuelAmount,
          form.fuelConsumption
        );
      const {
        distance: distanceToClosestGasStationInMeters,
        gasStation: closestGasStation,
      } = getClosestGasStationWithDistance(origin, gasStations);

      if (vehicleRangeInMeters < distanceToClosestGasStationInMeters) {
        toast.warn("Not enough fuel, call for help!");
        setRoute(null);
        return;
      }

      if (vehicleRangeInMeters < routeLengthInMeters) {
        toast.warn(
          "Not enough fuel to complete the trip without refill. Rebuilding a route..."
        );
        _route = await ttapi.services.calculateRoute({
          key: apiKey,
          locations: [origin, closestGasStation, ...sortedDestinations],
        });
      }

      toast.warn("Have a nice trip!");
      setRoute(_route.toGeoJson());
    }

    _perform().catch(console.error);
  }, [destinations, origin, gasStations, setRoute, form]);

  // useRenderRoute
  useEffect(() => {
    if (route === null || mapRef.current === null) {
      return;
    }

    mapRef.current.addLayer({
      id: "route",
      type: "line",
      source: {
        type: "geojson",
        data: route,
      },
      paint: {
        "line-color": "#4a90e2",
        "line-width": 6,
      },
    });

    return () => {
      mapRef.current.removeLayer("route");
      mapRef.current.removeSource("route");
    };
  }, [route]);

  return (
    <div className="app">
      <div ref={mapElementRef} className="map-container"></div>
      <div>Length in meters: {lengthInMeters}</div>
      <div>
        <button
          type="button"
          onClick={() => {
            setDestinations([]);
            setRoute(null);
          }}
        >
          Clear route
        </button>
      </div>
      <div>
        <h2>Characteristics</h2>
        <div>
          <label>
            <div>Consider traffic flow</div>
            <input type="checkbox" name="traffic-flow" />
          </label>
        </div>
        <div>
          <label>
            <div>Type of engine (Petrol/Disel)</div>
            <input type="text" name="enginetype" defaultValue="Petrol" />
          </label>
        </div>
        <div>
          <label>
            <div>Engine capacity (1,6/2.0/etc)</div>
            <input type="number" name="fuelConsumption" defaultValue="2.0" />
          </label>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setForm({
              fuelAmount: parseFloat(event.target.fuelAmount.value),
              fuelConsumption: parseFloat(event.target.fuelConsumption.value),
            });
          }}
        >
          <div>
            <label>
              <div>Fuel amount (liters)</div>
              <input
                type="number"
                name="fuelAmount"
                defaultValue="0.05"
                step="0.01"
              />
            </label>
          </div>
          <div>
            <label>
              <div>Average fuel consumption (liters per 100 kilometers)</div>
              <input
                type="number"
                name="fuelConsumption"
                defaultValue="5"
                step="0.01"
              />
            </label>
          </div>
          <br />
          <div>
            <button type="submit">Calculate</button>
          </div>
        </form>
      </div>
      <div className="notification-container">
        {/* Add the ToastContainer component within a specific container */}
        <ToastContainer />
      </div>
    </div>
  );
}

function useMap({ mapElementRef, longitude, latitude }) {
  const mapRef = useRef(null);

  useEffect(() => {
    if (mapElementRef === null) {
      return null;
    }

    mapRef.current = tt.map({
      key: apiKey,
      container: mapElementRef.current,
      center: [longitude, latitude],
      zoom: 14,
      stylesVisibility: {
        trafficIncidents: true,
        trafficFlow: true,
      },
    });
  }, []);

  return mapRef;
}

const sortDestinations = (locations, origin) => {
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

const convertToPoints = (lngLat) => {
  return {
    point: {
      longitude: lngLat.lng,
      latitude: lngLat.lat,
    },
  };
};

function getRouteLengthInMeters(route) {
  return (
    route?.routes?.[0]?.summary?.lengthInMeters ??
    route?.features?.[0]?.properties?.summary?.lengthInMeters ??
    0
  );
}

function getVehicleRangeInMetersByFuelAmountAndConsumption(
  fuelAmount,
  fuelConsumption,
  engineType,
  engineCapacity
) {
  const RANGE_PER_CONSUMPTION_UNIT_IN_KILOMETERS = 100;
  const KILOMETER_IN_METERS = 1000;

  // Adjust fuel consumption based on engine type and capacity
  if (engineType === "disel") {
    fuelConsumption *= 1; // no adjustment for petrol engines
  } else if (engineType === "petrol") {
    fuelConsumption *= 1.1; // 10% higher consumption for diesel engines
  }

  // Adjust fuel consumption based on engine capacity
  if (engineCapacity === 2.0) {
    fuelConsumption *= 1; // no adjustment for 2.0L engines
  } else if (engineCapacity === 1.6) {
    fuelConsumption *= 0.9; // 10% lower consumption for 1.6L engines
  }

  // 5 liters for 5l / 100km car means 100km of range
  const rangeInKilometers =
    (fuelAmount / fuelConsumption) * RANGE_PER_CONSUMPTION_UNIT_IN_KILOMETERS;

  return rangeInKilometers * KILOMETER_IN_METERS;
}

const getDistance = (coord1, coord2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000; // Radius of the Earth in meters

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

function getClosestGasStationWithDistance(origin, gasStations) {
  return gasStations.reduce(
    (accumulator, currentGasStation) => {
      const distanceToCurrentGasStation = getDistance(
        origin,
        currentGasStation
      );

      if (distanceToCurrentGasStation >= accumulator.distance) {
        return accumulator;
      }

      return {
        distance: distanceToCurrentGasStation,
        gasStation: currentGasStation,
      };
    },
    { distance: Infinity, gasStation: null }
  );
}
