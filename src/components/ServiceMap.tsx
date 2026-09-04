import React, { useEffect, useMemo, useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import MapView, { MapPressEvent, Marker, Region } from 'react-native-maps';

export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export type TechnicianMapMarker = MapCoordinate & {
  id: string;
  name: string;
  description?: string;
};

type Props = {
  location: MapCoordinate | null;
  technicians?: TechnicianMapMarker[];
  editable?: boolean;
  onLocationChange?: (coordinate: MapCoordinate) => void;
  style?: StyleProp<ViewStyle>;
};

const LIMA_REGION: Region = {
  latitude: -12.0464,
  longitude: -77.0428,
  latitudeDelta: 0.18,
  longitudeDelta: 0.18,
};

export function ServiceMap({ location, technicians = [], editable = false, onLocationChange, style }: Props) {
  const mapRef = useRef<MapView>(null);
  const coordinates = useMemo(
    () => [location, ...technicians].filter((item): item is MapCoordinate => Boolean(item)),
    [location, technicians]
  );

  useEffect(() => {
    if (!mapRef.current || coordinates.length === 0) return;
    if (coordinates.length === 1) {
      mapRef.current.animateToRegion({ ...coordinates[0], latitudeDelta: 0.012, longitudeDelta: 0.012 }, 350);
      return;
    }
    mapRef.current.fitToCoordinates(coordinates, {
      animated: true,
      edgePadding: { top: 45, right: 45, bottom: 45, left: 45 },
    });
  }, [coordinates]);

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
          description={technician.description || 'Técnico disponible'}
          pinColor="#1677FF"
        />
      ))}
    </MapView>
  );
}
