import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import MapView, { MapPressEvent, Marker, Polyline, Region } from 'react-native-maps';
import { toMapCoordinate } from '../services/monitoring';
import { fetchRouteWithEta, RouteInfo } from '../services/routing';

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
  showEtaBadge?: boolean;
  onRouteCalculated?: (info: RouteInfo) => void;
  onLocationChange?: (coordinate: MapCoordinate) => void;
  style?: StyleProp<ViewStyle>;
};

const LIMA_REGION: Region = {
  latitude: -12.0464,
  longitude: -77.0428,
  latitudeDelta: 0.18,
  longitudeDelta: 0.18,
};

export function ServiceMap({
  location: rawLocation,
  technicians = [],
  editable = false,
  showRoute = true,
  showEtaBadge = false,
  onRouteCalculated,
  onLocationChange,
  style,
}: Props) {
  const location = useMemo(() => toMapCoordinate(rawLocation), [rawLocation]);
  const mapRef = useRef<MapView>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<MapCoordinate[]>([]);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  // Trazar ruta cuando hay un destino y al menos un técnico
  useEffect(() => {
    let active = true;
    if (!showRoute || !location || technicians.length === 0) {
      setRouteCoordinates([]);
      setRouteInfo(null);
      return;
    }

    const technician = technicians[0];
    if (!technician || typeof technician.latitude !== 'number' || typeof technician.longitude !== 'number') {
      setRouteCoordinates([]);
      setRouteInfo(null);
      return;
    }

    void fetchRouteWithEta(technician, location).then((info) => {
      if (!active) return;
      setRouteCoordinates(info.coordinates);
      setRouteInfo(info);
      onRouteCalculated?.(info);
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

  const mapView = (
    <MapView
      ref={mapRef}
      style={showEtaBadge ? StyleSheet.absoluteFill : style}
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

  if (!showEtaBadge) return mapView;

  return (
    <View style={[{ position: 'relative', overflow: 'hidden' }, style]}>
      {mapView}
      {routeInfo && routeInfo.distanceMeters > 0 ? (
        <View style={etaStyles.etaBadge}>
          <Text style={etaStyles.etaText}>
            ⏱️ Llegada estimada: <Text style={{ fontWeight: '900' }}>~{routeInfo.durationText}</Text> ({routeInfo.distanceText})
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const etaStyles = StyleSheet.create({
  etaBadge: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
  etaText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
});

