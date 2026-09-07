import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import MapView, { MapPressEvent, Marker, Polyline, Region } from 'react-native-maps';
import { toMapCoordinate } from '../services/monitoring';
import { fetchRouteCoordinates } from '../services/routing';

export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export type TechnicianMapMarker = MapCoordinate & {
  id: string;
  name: string;
  description?: string;
  color?: string;
};

type Props = {
  location: MapCoordinate | null;
  technicians?: TechnicianMapMarker[];
  editable?: boolean;
  showRoute?: boolean;
  onLocationChange?: (coordinate: MapCoordinate) => void;
  style?: StyleProp<ViewStyle>;
};

const LIMA_REGION: Region = {
  latitude: -12.0464,
  longitude: -77.0428,
  latitudeDelta: 0.18,
  longitudeDelta: 0.18,
};

export function ServiceMap({ location: rawLocation, technicians = [], editable = false, showRoute = true, onLocationChange, style }: Props) {
  const location = useMemo(() => toMapCoordinate(rawLocation), [rawLocation]);
  const mapRef = useRef<MapView>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<MapCoordinate[]>([]);

  // Trazar ruta cuando hay un destino y al menos un técnico
  useEffect(() => {
    let active = true;
    if (!showRoute || !location || technicians.length === 0) {
      setRouteCoordinates([]);
      return;
    }

    const technician = technicians[0];
    if (!technician || typeof technician.latitude !== 'number' || typeof technician.longitude !== 'number') {
      setRouteCoordinates([]);
      return;
    }

    void fetchRouteCoordinates(technician, location).then((coords) => {
      if (!active) return;
      setRouteCoordinates(coords);
    });

    return () => {
      active = false;
    };
  }, [location?.latitude, location?.longitude, technicians[0]?.latitude, technicians[0]?.longitude, showRoute]);

  const coordinates = useMemo(
    () => [location, ...technicians, ...(routeCoordinates.length > 0 ? routeCoordinates : [])].filter((item): item is MapCoordinate => Boolean(item)),
    [location, technicians, routeCoordinates]
  );

  useEffect(() => {
    if (!mapRef.current || coordinates.length === 0) return;
    if (coordinates.length === 1) {
      mapRef.current.animateToRegion({ ...coordinates[0], latitudeDelta: 0.012, longitudeDelta: 0.012 }, 350);
      return;
    }
    mapRef.current.fitToCoordinates(coordinates, {
      animated: true,
      edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
    });
  }, [location?.latitude, location?.longitude, technicians[0]?.latitude, technicians[0]?.longitude]);

  const handlePress = (event: MapPressEvent) => {
    if (editable) onLocationChange?.(event.nativeEvent.coordinate);
  };

  return (
    <MapView
      ref={mapRef}
      style={style}
      initialRegion={location ? { ...location, latitudeDelta: 0.012, longitudeDelta: 0.012 } : LIMA_REGION}
      onPress={handlePress}
      showsCompass
      showsTraffic={false}
      toolbarEnabled={false}
    >
      {/* Trazado de ruta estilo Uber: borde exterior oscuro y línea interior viva */}
      {routeCoordinates.length > 0 && (
        <>
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#0369a1"
            strokeWidth={6}
            lineCap="round"
            lineJoin="round"
          />
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#0284c7"
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        </>
      )}

      {location ? (
        <Marker
          coordinate={location}
          title="Ubicación del servicio"
          description={editable ? 'Arrastra el marcador para ajustar el punto' : 'Dirección confirmada por el cliente'}
          draggable={editable}
          onDragEnd={(event) => onLocationChange?.(event.nativeEvent.coordinate)}
          pinColor="#E74C3C"
        />
      ) : null}
      {technicians.map((technician) => (
        <Marker
          key={technician.id}
          coordinate={technician}
          title={technician.name}
          description={technician.description || 'Técnico en camino'}
          pinColor={technician.color || '#1677FF'}
        />
      ))}
    </MapView>
  );
}
