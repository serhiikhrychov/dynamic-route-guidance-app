import './App.css';
import '@tomtom-international/web-sdk-maps/dist/maps.css';
import {useEffect, useRef, useState } from "react";
import * as tt from '@tomtom-international/web-sdk-maps'

const App = () => {
  const apiKey = process.env.REACT_APP_TOM_TOM_API_KEY;
  const mapElement = useRef();
  const [map, setMap] = useState({});
  // const [longitude, setLongitude] = useState(30.5234);
  // const [latitude, setLatitude] = useState(50.4501);
    const [longitude, setLongitude] = useState(21.0122);
    const [latitude, setLatitude] = useState(52.2297);

useEffect(() => {
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
  };

  addMarker();

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
