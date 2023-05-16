import './App.css';
import '@tomtom-international/web-sdk-maps/dist/maps.css';
import {useEffect, useRef, useState } from "react";
import * as tt from '@tomtom-international/web-sdk-maps'
import * as ttapi from '@tomtom-international/web-sdk-services'

const App = () => {
  const apiKey = process.env.REACT_APP_TOM_TOM_API_KEY;
  const mapElement = useRef();
  const [map, setMap] = useState({});
  // const [longitude, setLongitude] = useState(30.5234);
  // const [latitude, setLatitude] = useState(50.4501);
    const [longitude, setLongitude] = useState(21.0122);
    const [latitude, setLatitude] = useState(52.2297);

    const convertToPoints = (lngLat) => {
        return {
            point: {
                longitude: lngLat.lat,
                latitude: lngLat.lng
            }
        }
    }

    const drawRoute = (geoJson, map) => {
        if (map.getLayer('route')) {
            map.removeLayer('route');
            map.removeSource('route');
        }
        map.addLayer({
            id: 'route',
            type: 'line',
            source: {
                type: 'geojson',
                data: geoJson
            },
            paint: {
                'line-color': '#4a90e2',
                'line-width': 6
            }
        })
    };

    const addDeliveryMarker = (lngLat, map) => {
        const element = document.createElement('div');
        element.className = 'marker-delivery';
        new tt.Marker({
            element: element
        })
            .setLngLat(lngLat)
            .addTo(map);
    };

useEffect(() => {
  const origin = {
        lng: longitude,
        lat: latitude
  }
    const destinations = [];

  let map = tt.map({
    key: apiKey,
    container: mapElement.current,
    center: [longitude, latitude],
    zoom: 14,
    stylesVisibility: {
        trafficIncidents: true,
        trafficFlow: true
    }
  })

  setMap(map)
  const addMarker = () => {
      const popupOffset = {
          bottom: [0, -25]
      }
      const popup = new tt.Popup({offset: popupOffset}).setHTML('this is you');
    const element = document.createElement('div');
    element.className = 'marker';

    const marker = new tt.Marker({
        draggable: true,
        element: element,
    }).setLngLat([longitude, latitude]).addTo(map);

    marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        setLongitude(lngLat.lng);
        setLatitude(lngLat.lat);
    });

    marker.setPopup(popup).togglePopup();
  };

  addMarker();

  const sortDestinations = (locations) => {
      const pointsForDestinations = locations.map((destination) => {
          return convertToPoints(destination)
      })
      const callParams = {
          key: apiKey,
          destinations: pointsForDestinations,
          origins: [convertToPoints(origin)]
      }
      return new Promise((resolve, reject) => {
          ttapi.services.matrixRouting(callParams)
              .then((matrixAPIResults) => {
                    const results = matrixAPIResults.matrix[0];
                    const resultsArray = results.map((result, index) => {
                        return {
                            location: locations[index],
                            drivingtime: result.response.summary?.travelTimeInSeconds || 0,
                        }
                    })
                    resultsArray.sort((a, b) => {
                        return a.drivingtime - b.drivingtime;
                    })
                    const sortedLocations = resultsArray.map((result) => {
                        return result.location;
                    })
                    resolve(sortedLocations);
              })
      });
  }

  const recalculateRoutes = () => {
            sortDestinations(destinations).then((sorted) => {
                sorted.unshift(origin);

                ttapi.services.calculateRoute({
                    key: apiKey,
                    locations: sorted
                })
                    .then((routeData) => {
                        const geojson = routeData.toGeoJson();
                        drawRoute(geojson, map)
                    })
            })
  };

    map.on('click', (e) => {
        destinations.push(e.lngLat);
        addDeliveryMarker(e.lngLat, map);
        recalculateRoutes();
    })

  return () => map.remove();
}, [longitude, latitude]);

  return (
      <>
      { map && <div className="app">
      <div ref={mapElement} className="map-container"/>
      <div className="search-bar">
        <h1>Where to</h1>
        <input
            type="text"
            id="longitude"
            className="longitude"
            placeholder="Set longitude"
            onChange= {e => setLongitude(e.target.value)}
        />
        <input
            type="text"
            id="latitude"
            className="latitude"
            placeholder="Set latitude"
            onChange= {e => setLatitude(e.target.value)}
        />
      </div>
    </div>}
      </>
  );
}

export default App;
