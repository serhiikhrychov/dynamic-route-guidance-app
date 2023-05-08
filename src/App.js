import './App.css';
import {useEffect, useRef, useState } from "react";
import * as tt from '@tomtom-international/web-sdk-maps'

const App = () => {
  const apiKey = process.env.REACT_APP_TOM_TOM_API_KEY;
  const mapElement = useRef();
  const [map, setMap] = useState({});

useEffect(() => {
  let map = tt.map({
    key: apiKey,
    container: mapElement.current,
  });

  setMap(map);
}, []);

  return (
    <div className="App">
      <div ref={mapElement} className="map-container" />
    </div>
  );
}

export default App;
