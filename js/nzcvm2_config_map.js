// Initialize map centered on New Zealand
const map = L.map('map').setView([-41.2865, 174.7762], 6);

// Add tile layer (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Define initial parameters for the rectangle
const initialOriginLat = -41.2865;
const initialOriginLng = 174.7762;
const initialExtentX = 300; // width in km
const initialExtentY = 300; // height in km

// Create a rectangle around Wellington
const bounds = calculateBoundsFromOriginAndExtents(
    initialOriginLat,
    initialOriginLng,
    initialExtentX,
    initialExtentY
);

const rectangle = L.rectangle(bounds, {
    color: "#ff7800",
    weight: 2,
    fillOpacity: 0.2
}).addTo(map);



// Variables for GeoJSON overlay
let currentGeoJSONLayer = null;
let legend = null;

// New variables for rotation handle
let rotationHandle = null;
let rotationLine = null;
let rotationHandleDistance = 50; // pixels

// Function to add a legend to the map
function addLegend() {
    if (legend) {
        map.removeControl(legend);
    }
    
    legend = L.control({position: 'bottomright'});
    legend.onAdd = function() {
        const div = L.DomUtil.create('div', 'legend');
        div.innerHTML = '<h4>Basin Regions</h4>' +
                       '<i style="background:#ba0045"></i> Basin Areas<br>';
        return div;
    };
    legend.addTo(map);
}

// Function to load and display GeoJSON based on model version
function loadGeoJSONByModelVersion(modelVersion) {
    // Clear existing GeoJSON layer if any
    if (currentGeoJSONLayer) {
        map.removeLayer(currentGeoJSONLayer);
        currentGeoJSONLayer = null;
        if (legend) {
            map.removeControl(legend);
            legend = null;
        }
    }
    
    // Map model version to corresponding GeoJSON file
    let filename = '';
    if (modelVersion === '2.03') {
        filename = 'model_version_2p03_basins.geojson';
    } else if (modelVersion === '2.07') {
        filename = 'model_version_2p07_basins.geojson';
    } else {
        return; // No valid model version selected
    }
    
    // Updated path to GeoJSON files with new structure
    const geoJsonUrl = 'data/basins/' + filename;
    
    // Create a loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-indicator';
    loadingDiv.style.position = 'absolute';
    loadingDiv.style.top = '50%';
    loadingDiv.style.left = '50%';
    loadingDiv.style.transform = 'translate(-50%, -50%)';
    loadingDiv.style.background = 'white';
    loadingDiv.style.padding = '10px';
    loadingDiv.style.borderRadius = '5px';
    loadingDiv.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
    loadingDiv.style.zIndex = '1000';
    loadingDiv.innerText = 'Loading GeoJSON data...';
    document.getElementById('map-container').appendChild(loadingDiv);
    
    console.log('Attempting to load GeoJSON from:', geoJsonUrl);
    
    // Fetch the GeoJSON file
    fetch(geoJsonUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            // Use performance optimized approach for GeoJSON rendering
            currentGeoJSONLayer = L.geoJSON(data, {
                style: function() {
                    return {
                        color: "#ba0045",
                        weight: 1,
                        fillOpacity: 0.3
                    };
                },
                // Use custom filter to reduce the number of features if needed
                filter: function(feature) {
                    // Only include features that have coordinates
                    return feature.geometry && 
                           feature.geometry.coordinates && 
                           feature.geometry.coordinates.length > 0 &&
                           feature.geometry.coordinates[0].length > 0;
                },
                onEachFeature: function(feature, layer) {
                    if (feature.properties && feature.properties.source_file) {
                        layer.bindTooltip(feature.properties.source_file);
                    }
                }
            }).addTo(map);
            
            // Add legend
            addLegend();
            
            // Remove loading indicator
            document.getElementById('loading-indicator').remove();
            
            // Ensure rectangle stays on top of GeoJSON layer
            rectangle.bringToFront();
        })
        .catch(error => {
            const errorMsg = error.message || 'Unknown error';
            console.error('Error loading GeoJSON:', error);
            
            // Create a more detailed error message
            const detailedAlert = document.createElement('div');
            detailedAlert.id = 'error-message';
            detailedAlert.style.position = 'absolute';
            detailedAlert.style.top = '50%';
            detailedAlert.style.left = '50%';
            detailedAlert.style.transform = 'translate(-50%, -50%)';
            detailedAlert.style.background = 'white';
            detailedAlert.style.padding = '15px';
            detailedAlert.style.borderRadius = '5px';
            detailedAlert.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
            detailedAlert.style.zIndex = '1000';
            detailedAlert.style.maxWidth = '80%';
            detailedAlert.style.textAlign = 'left';
            detailedAlert.innerHTML = `
                <h3 style="color: red; margin-top: 0;">Error Loading GeoJSON</h3>
                <p><strong>File:</strong> ${filename}</p>
                <p><strong>URL:</strong> ${geoJsonUrl}</p>
                <p><strong>Error:</strong> ${errorMsg}</p>
                <p>Please check the console for more details.</p>
                <button id="close-error" style="padding: 5px 10px; float: right;">Close</button>
            `;
            document.getElementById('map-container').appendChild(detailedAlert);
            
            // Add event listener to close button
            document.getElementById('close-error').addEventListener('click', function() {
                document.getElementById('error-message').remove();
            });
            
            // Remove loading indicator if it exists
            const loadingIndicator = document.getElementById('loading-indicator');
            if (loadingIndicator) {
                loadingIndicator.remove();
            }
        });
}

// Add change event listener for model version selection
document.getElementById('model-version').addEventListener('change', function() {
    loadGeoJSONByModelVersion(this.value);
});

// Load initial GeoJSON based on default selected model version
document.addEventListener('DOMContentLoaded', function() {
    const initialModelVersion = document.getElementById('model-version').value;
    loadGeoJSONByModelVersion(initialModelVersion);
});

// Variables to track interaction state
let isDragging = false;
let isResizing = false;
let isRotating = false;
let lastPos = null;
let resizeEdge = null;
let rotationAngle = 0;
let rectangleCenter = null;
let edgeThreshold = 0.01; // Threshold for edge detection (in degrees)

// Create rotation handle icon
const rotationIcon = L.divIcon({
    className: 'rotation-handle-icon',
    html: '<div class="rotation-icon"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
});

// Function to create and position the rotation handle
function createRotationHandle() {
    if (rotationHandle) {
        map.removeLayer(rotationHandle);
    }
    
    if (rotationLine) {
        map.removeLayer(rotationLine);
    }
    
    // Get the center and bounds of the rectangle
    const bounds = rectangle.getBounds();
    const center = bounds.getCenter();
    rectangleCenter = center;
    
    // Calculate position for rotation handle at a fixed distance from the top edge
    updateRotationHandlePosition();
    
    // Apply rotation to handle and line
    updateRotationHandlePosition();
}

// Function to update rotation handle position when rectangle is moved or rotated
function updateRotationHandlePosition() {
    if (!rectangle) return;
    
    // Remove existing handle and line if they exist
    if (rotationHandle) {
        map.removeLayer(rotationHandle);
    }
    
    if (rotationLine) {
        map.removeLayer(rotationLine);
    }
    
    const bounds = rectangle.getBounds();
    const center = bounds.getCenter();
    
    // Calculate the top center point of the rectangle (before rotation)
    const topCenter = L.latLng((bounds.getNorth()), center.lng);
    
    // Calculate the position with rotation applied
    const centerPoint = map.latLngToLayerPoint(center);
    const topCenterPoint = map.latLngToLayerPoint(topCenter);
    
    // Calculate vector from center to top center
    const vecX = topCenterPoint.x - centerPoint.x;
    const vecY = topCenterPoint.y - centerPoint.y;
    
    // Apply rotation to this vector
    const angle = rotationAngle * (Math.PI / 180);
    const rotatedVecX = vecX * Math.cos(angle) - vecY * Math.sin(angle);
    const rotatedVecY = vecX * Math.sin(angle) + vecY * Math.cos(angle);
    
    // Calculate the rotated top center point
    const rotatedTopCenterX = centerPoint.x + rotatedVecX;
    const rotatedTopCenterY = centerPoint.y + rotatedVecY;
    const rotatedTopCenterPoint = L.point(rotatedTopCenterX, rotatedTopCenterY);
    
    // Calculate the handle position at a fixed distance from the rotated top center
    const handleX = rotatedTopCenterX + rotationHandleDistance * Math.sin(angle);
    const handleY = rotatedTopCenterY - rotationHandleDistance * Math.cos(angle);
    const handlePoint = L.point(handleX, handleY);
    
    const rotatedTopCenter = map.layerPointToLatLng(rotatedTopCenterPoint);
    const handleLatLng = map.layerPointToLatLng(handlePoint);
    
    // Create the rotation handle
    rotationHandle = L.marker(handleLatLng, {
        icon: rotationIcon,
        draggable: false,
        zIndexOffset: 1000
    }).addTo(map);
    
    // Add click handler to rotation handle
    rotationHandle.on('mousedown', function(e) {
        isRotating = true;
        lastPos = e.latlng;
        map.dragging.disable(); // Disable map dragging while rotating
        
        // Prevent event propagation
        L.DomEvent.stopPropagation(e);
        L.DomEvent.preventDefault(e);
    });
    
    // Create connecting line from top center of rectangle to handle
    rotationLine = L.polyline([rotatedTopCenter, handleLatLng], {
        color: '#ff7800',
        weight: 1.5,
        opacity: 0.7,
        dashArray: '5, 5'
    }).addTo(map);
}

// Function to apply rotation to rectangle
function applyRotation() {
    const center = rectangle.getBounds().getCenter();
    rectangleCenter = center;
    
    // Apply rotation transformation using CSS
    rectangle._path.style.transformOrigin = `${map.latLngToLayerPoint(center).x}px ${map.latLngToLayerPoint(center).y}px`;
    rectangle._path.style.transform = `rotate(${rotationAngle}deg)`;
    
    // Update form with new rotation value
    document.getElementById('rotation').value = rotationAngle.toFixed(1);
    
    // Update rotation handle position
    updateRotationHandlePosition();
}

// Function to convert kilometers to degrees latitude/longitude
function kmToDegrees(km, centerLat) {
    // Earth's radius in km at the equator
    const earthRadius = 6371;
    
    // Conversion for latitude is straightforward
    const latDegrees = km / 111.32; // 1 degree latitude is approximately 111.32 km
    
    // Longitude depends on the latitude due to the Earth's curvature
    const latRadians = centerLat * (Math.PI / 180);
    const lngDegrees = km / (111.32 * Math.cos(latRadians));
    
    return { lat: latDegrees, lng: lngDegrees };
}

// Function to convert degrees to kilometers
function degreesToKm(lat, lng, centerLat) {
    const latKm = lat * 111.32; // 1 degree latitude is approximately 111.32 km
    
    const latRadians = centerLat * (Math.PI / 180);
    const lngKm = lng * (111.32 * Math.cos(latRadians));
    
    return { latKm, lngKm };
}

// Function to calculate rectangle bounds from origin and extents
function calculateBoundsFromOriginAndExtents(originLat, originLng, extentX, extentY) {
    // Convert extents from kilometers to degrees
    const extentsDegrees = kmToDegrees(extentX / 2, originLat);
    const extentsDegreesY = kmToDegrees(extentY / 2, originLat);
    
    // Calculate southwest and northeast corners
    const swLat = originLat - extentsDegreesY.lat;
    const swLng = originLng - extentsDegrees.lng;
    const neLat = originLat + extentsDegreesY.lat;
    const neLng = originLng + extentsDegrees.lng;
    
    return [
        [swLat, swLng], // Southwest corner
        [neLat, neLng]  // Northeast corner
    ];
}

// Function to update form with current rectangle bounds
function updateFormValues() {
    const bounds = rectangle.getBounds();
    const center = bounds.getCenter();
    const originLat = center.lat;
    const originLng = center.lng;
    
    // Calculate extents in kilometers
    const width = degreesToKm(0, bounds.getEast() - bounds.getWest(), originLat).lngKm;
    const height = degreesToKm(bounds.getNorth() - bounds.getSouth(), 0, originLat).latKm;
    
    // Update form fields
    document.getElementById('origin-lat').value = originLat.toFixed(6);
    document.getElementById('origin-lng').value = originLng.toFixed(6);
    document.getElementById('extent-x').value = width.toFixed(3);
    document.getElementById('extent-y').value = height.toFixed(3);
    document.getElementById('rotation').value = rotationAngle.toFixed(1);
}

// Initialize form values
updateFormValues();

// Handle form submission to update rectangle
document.getElementById('apply-btn').addEventListener('click', function() {
    const originLat = parseFloat(document.getElementById('origin-lat').value);
    const originLng = parseFloat(document.getElementById('origin-lng').value);
    const extentX = parseFloat(document.getElementById('extent-x').value);
    const extentY = parseFloat(document.getElementById('extent-y').value);
    const newRotation = parseFloat(document.getElementById('rotation').value);
    
    if (!isNaN(originLat) && !isNaN(originLng) && !isNaN(extentX) && !isNaN(extentY)) {
        // Calculate new bounds from origin and extents
        const newBounds = calculateBoundsFromOriginAndExtents(originLat, originLng, extentX, extentY);
        
        // Update rectangle bounds
        rectangle.setBounds(newBounds);
        
        // Update rotation if changed
        if (!isNaN(newRotation) && newRotation !== rotationAngle) {
            rotationAngle = newRotation;
        }
        
        // Apply rotation
        applyRotation();
    }
});

// Calculate angle between three points
function calculateAngle(center, p1, p2) {
    const angle1 = Math.atan2(p1.lat - center.lat, p1.lng - center.lng);
    const angle2 = Math.atan2(p2.lat - center.lat, p2.lng - center.lng);
    return ((angle2 - angle1) * 180 / Math.PI);
}

// Check if the point is near an edge
function getResizeEdge(point, bounds) {
    const north = bounds.getNorth();
    const south = bounds.getSouth();
    const east = bounds.getEast();
    const west = bounds.getWest();
    
    // Check each edge with threshold
    if (Math.abs(point.lat - north) < edgeThreshold) {
        if (Math.abs(point.lng - east) < edgeThreshold) {
            return 'ne';
        } else if (Math.abs(point.lng - west) < edgeThreshold) {
            return 'nw';
        } else {
            return 'n';
        }
    } else if (Math.abs(point.lat - south) < edgeThreshold) {
        if (Math.abs(point.lng - east) < edgeThreshold) {
            return 'se';
        } else if (Math.abs(point.lng - west) < edgeThreshold) {
            return 'sw';
        } else {
            return 's';
        }
    } else if (Math.abs(point.lng - east) < edgeThreshold) {
        return 'e';
    } else if (Math.abs(point.lng - west) < edgeThreshold) {
        return 'w';
    }
    
    return null;
}

// Set appropriate cursor based on edge
function updateCursor(edge) {
    if (!edge) {
        rectangle._path.style.cursor = '';
        return;
    }
    
    switch (edge) {
        case 'n':
        case 's':
            rectangle._path.style.cursor = 'ns-resize';
            break;
        case 'e':
        case 'w':
            rectangle._path.style.cursor = 'ew-resize';
            break;
        case 'ne':
        case 'sw':
            rectangle._path.style.cursor = 'nesw-resize';
            break;
        case 'nw':
        case 'se':
            rectangle._path.style.cursor = 'nwse-resize';
            break;
        default:
            rectangle._path.style.cursor = 'move';
    }
}

// Change cursor on mousemove
rectangle.on('mousemove', function(e) {
    if (isDragging || isResizing || isRotating) return;
    
    const edge = getResizeEdge(e.latlng, rectangle.getBounds());
    updateCursor(edge);
});

// Make rectangle interactive
rectangle.on('mousedown', function(e) {
    const bounds = rectangle.getBounds();
    const edge = getResizeEdge(e.latlng, bounds);
    
    // Store rectangle center for rotation calculations
    rectangleCenter = bounds.getCenter();
    
    if (edge) {
        isResizing = true;
        resizeEdge = edge;
    } else {
        isDragging = true;
    }
    
    lastPos = e.latlng;
    map.dragging.disable(); // Disable map dragging
    
    // Prevent event propagation
    L.DomEvent.stopPropagation(e);
    L.DomEvent.preventDefault(e);
});

// Handle mouse movement
document.addEventListener('mousemove', function(e) {
    if (!isDragging && !isResizing && !isRotating) return;
    
    // Convert screen position to map coordinates
    const containerPoint = new L.Point(e.clientX, e.clientY);
    const layerPoint = map.containerPointToLayerPoint(containerPoint);
    const latlng = map.layerPointToLatLng(layerPoint);
    
    if (isRotating && rectangleCenter) {
        // Calculate rotation angle and reverse the direction
        const angleDelta = -calculateAngle(rectangleCenter, lastPos, latlng);
        rotationAngle = (rotationAngle + angleDelta) % 360;
        
        // Apply the rotation
        applyRotation();
    } else if (isDragging) {
        // Calculate the movement delta
        const latDiff = latlng.lat - lastPos.lat;
        const lngDiff = latlng.lng - lastPos.lng;
        
        const currentBounds = rectangle.getBounds();
        const sw = currentBounds.getSouthWest();
        const ne = currentBounds.getNorthEast();
        
        // Update rectangle position
        rectangle.setBounds([
            [sw.lat + latDiff, sw.lng + lngDiff],
            [ne.lat + latDiff, ne.lng + lngDiff]
        ]);
        
        // Reapply rotation after moving
        applyRotation();
        
        // Update form values
        updateFormValues();
        
    } else if (isResizing) {
        const currentBounds = rectangle.getBounds();
        let sw = currentBounds.getSouthWest();
        let ne = currentBounds.getNorthEast();
        
        // Update the appropriate coordinate based on which edge is being resized
        switch (resizeEdge) {
            case 'n':
                ne = L.latLng(latlng.lat, ne.lng);
                break;
            case 's':
                sw = L.latLng(latlng.lat, sw.lng);
                break;
            case 'e':
                ne = L.latLng(ne.lat, latlng.lng);
                break;
            case 'w':
                sw = L.latLng(sw.lat, latlng.lng);
                break;
            case 'ne':
                ne = latlng;
                break;
            case 'nw':
                ne = L.latLng(latlng.lat, ne.lng);
                sw = L.latLng(sw.lat, latlng.lng);
                break;
            case 'se':
                ne = L.latLng(ne.lat, latlng.lng);
                sw = L.latLng(latlng.lat, sw.lng);
                break;
            case 'sw':
                sw = latlng;
                break;
        }
        
        rectangle.setBounds([sw, ne]);
        
        // Reapply rotation after resizing
        applyRotation();
        
        // Update form values
        updateFormValues();
    }
    
    // Update last position
    lastPos = latlng;
});

// End interaction on mouseup
document.addEventListener('mouseup', function() {
    if (!(isDragging || isResizing || isRotating)) return;
    
    // End interaction
    isDragging = false;
    isResizing = false;
    isRotating = false;
    resizeEdge = null;
    lastPos = null;
    
    // Re-enable map dragging
    map.dragging.enable();
    
    // Update form values when interaction ends
    updateFormValues();
});

// Reset cursor when mouse leaves the rectangle
rectangle.on('mouseout', function() {
    if (!(isDragging || isResizing || isRotating)) {
        rectangle._path.style.cursor = '';
    }
});

// Initialize rotation and rotation handle
map.on('layeradd', function(e) {
    if (e.layer === rectangle) {
        // Wait a bit to ensure rectangle is properly initialized
        setTimeout(function() {
            applyRotation();
            createRotationHandle();
        }, 100);
    }
});

// Add these event listeners to update rotation handle when map changes
map.on('zoomend', function() {
    if (rectangle) {
        applyRotation();
        updateRotationHandlePosition();
    }
});

map.on('moveend', function() {
    if (rectangle) {
        applyRotation();
        updateRotationHandlePosition();
    }
});

map.on('drag', function() {
    if (rectangle) {
        applyRotation();
        updateRotationHandlePosition();
    }
});

// Initialize rotation handle after rectangle is created
setTimeout(createRotationHandle, 500);

// Function to download corner coordinates
function downloadConfigFile() {
    // Get form values for configuration file
    const originLat = parseFloat(document.getElementById('origin-lat').value);
    const originLng = parseFloat(document.getElementById('origin-lng').value);
    const extentX = parseFloat(document.getElementById('extent-x').value);
    const extentY = parseFloat(document.getElementById('extent-y').value);
    const rotation = parseFloat(document.getElementById('rotation').value);
    
    // Get additional parameters
    const latlonSpacing = parseFloat(document.getElementById('latlon-spacing').value);
    const extentZmax = parseFloat(document.getElementById('extent-zmax').value);
    const extentZmin = parseFloat(document.getElementById('extent-zmin').value);
    const zSpacing = parseFloat(document.getElementById('z-spacing').value);
    const minVs = parseFloat(document.getElementById('min-vs').value);
    const modelVersion = document.getElementById('model-version').value;
    const topoType = document.getElementById('topo-type').value;
    const outputDir = document.getElementById('output-dir').value || '/tmp';
    
    // Create configuration file content
    const config = [
        'CALL_TYPE=GENERATE_VELOCITY_MOD',
        `MODEL_VERSION=${modelVersion}`,
        `ORIGIN_LAT=${originLat.toFixed(6)}`,
        `ORIGIN_LON=${originLng.toFixed(6)}`,
        `ORIGIN_ROT=${rotation.toFixed(1)}`,
        `EXTENT_X=${extentX.toFixed(3)}`,
        `EXTENT_Y=${extentY.toFixed(3)}`,
        `EXTENT_ZMAX=${extentZmax.toFixed(1)}`,
        `EXTENT_ZMIN=${extentZmin.toFixed(1)}`,
        `EXTENT_Z_SPACING=${zSpacing.toFixed(1)}`,
        `EXTENT_LATLON_SPACING=${latlonSpacing.toFixed(1)}`,
        `MIN_VS=${minVs.toFixed(1)}`,
        `TOPO_TYPE=${topoType}`,
        `OUTPUT_DIR=${outputDir}`
    ].join('\n');
    
    // Create blob and download
    const blob = new Blob([config], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nzvm.cfg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Add click event to download button
document.getElementById('downloadBtn').addEventListener('click', downloadConfigFile);
