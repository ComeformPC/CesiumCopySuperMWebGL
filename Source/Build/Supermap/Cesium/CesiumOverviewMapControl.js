var CesiumOverviewMapControl = function () {
    this.init.apply(this, arguments);
};

CesiumOverviewMapControl.prototype = {
    _container: null,
    _miniMap: null,
    _viewerMoving: false,
    _miniMapMoving: false,
    _userToggledDisplay: false,
    _minimized: false,
	_isScreen:false,
	_oldWidth:'',
	_oldHeight:'',
    viewer: null,
    tileLayer: null,
	pipeLayerObj:null,
	pipeLayer:{
		url:"",
		subLayers:null
	},
    options: {
        position: 'bottomleft',
        toggleDisplay: true,
        zoomLevelOffset: -5,
        zoomLevelFixed: false,
        centerFixed: false,
        zoomControl: false,
        zoomAnimation: false,
        autoToggleDisplay: false,
        minimized: false,
		isScreen:false,
        width: '150px',
        height: '150px',
        collapsedWidth: '19px',
        collapsedHeight: '19px',
        aimingRectOptions: { color: '#ff7800', weight: 1, interactive: false },
        shadowRectOptions: { color: '#000000', weight: 1, interactive: false, opacity: 0, fillOpacity: 0 },
        strings: { hideText: '隐藏鹰眼', showText: '显示鹰眼' },
        mapOptions: {
            toggleDisplay: true,
            aimingRectOptions: {
                color: "#ff1100",
                weight: 3
            },
            shadowRectOptions: {
                color: "#0000AA",
                weight: 1,
                opacity: 0,
                fillOpacity: 0
            }
        }
    },
    init: function (viewer, layer, options) {
        this.viewer = viewer;
        this.tileLayer = layer;
        this._container = options.container;
        L.Util.setOptions(this, options);

        this.options.aimingRectOptions.interactive = false;
        this.options.shadowRectOptions.interactive = false;
		this._isScreen=this.options.isScreen;
        this._initMap();
        this._showInitView();
		return this;
    },
    updateAimingRect: function () {
        var _this = this;
        var rect = _this._getViewRange();
		if(rect)
			_this._aimingRect.setBounds(rect);
    },
	splitScreen: function (options) {//分屏		
		this._oldWidth=this.options.width;
		this._oldHeight=this.options.height;
		this.options.width=options.width;
		this.options.height=options.height;
		this._container.style.width = this.options.width;
        this._container.style.height = this.options.height;
		this._miniMap.remove();
		$(this._container).empty().removeAttr("style").removeAttr("tabindex").removeClass("leaflet-container").removeClass("leaflet-touch").removeClass("leaflet-fade-anim");
		this._miniMap=null;	
		this._isScreen=true;		
		setTimeout(function () { 
			this.viewer.scene.camera.moveEnd._listeners=[];
			this.viewer.scene.camera.moveEnd._scopes=[];
			this.viewer.scene.camera.moveStart._listeners=[];
			this.viewer.scene.camera.moveStart._scopes=[];
			this._initMap();		
			this._showInitView();
        }.bind(this), 300);		
    },
	restoreScreen:function(){		
		this.options.width=this._oldWidth;
		this.options.height=this._oldHeight;
		this._container.style.width = this.options.width;
        this._container.style.height = this.options.height;
		this._miniMap.remove();
		$(this._container).empty().removeAttr("style").removeAttr("tabindex").removeClass("leaflet-container").removeClass("leaflet-touch").removeClass("leaflet-fade-anim");
		this._miniMap=null;	
		this._isScreen=false;		
		setTimeout(function () { 
			this.viewer.scene.camera.moveEnd._listeners=[];
			this.viewer.scene.camera.moveEnd._scopes=[];
			this.viewer.scene.camera.moveStart._listeners=[];
			this.viewer.scene.camera.moveStart._scopes=[];
			this._initMap();		
			this._showInitView();
        }.bind(this), 300);		
	},
    _initMap: function () {
        var _this = this;

        this._container.style.width = this.options.width;
        this._container.style.height = this.options.height

        L.DomEvent.disableClickPropagation(_this._container);
        L.DomEvent.on(_this._container, 'mousewheel', L.DomEvent.stopPropagation);

        var mapOptions = {
			logoControl: false,
            attributionControl: false,
            dragging: !_this.options.centerFixed,
            zoomControl: _this.options.zoomControl,
            zoomAnimation: _this.options.zoomAnimation,
            autoToggleDisplay: _this.options.autoToggleDisplay,
            touchZoom: _this.options.centerFixed ? 'center' : !_this._isZoomLevelFixed(),
            scrollWheelZoom: _this.options.centerFixed ? 'center' : !_this._isZoomLevelFixed(),
            doubleClickZoom: _this.options.centerFixed ? 'center' : !_this._isZoomLevelFixed(),
            boxZoom: !_this._isZoomLevelFixed(),
            crs: L.CRS.EPSG4326,//L.CRS.TianDiTu_WGS84,
			//crs: L.CRS.EPSG3857,
            center: [0, 0],
            zoom: 1
        };
        mapOptions = L.Util.extend(_this.options.mapOptions, mapOptions);  // merge
        // with
        // priority
        // of
        // the
        // local
        // mapOptions
        // object.

        _this._miniMap = new L.Map(_this._container, mapOptions);

        var layer = this.tileLayer;
        layer.forEach(function(item,index){
            _this._miniMap.addLayer(item);
        }.bind(_this))
		if(this.pipeLayer && this.pipeLayer.subLayers)
			this.addPipeLayers(this.pipeLayer.url,this.pipeLayer.subLayers);
        

        // These bools are used to prevent infinite loops of the two maps
        // notifying each other that they've moved.
        _this._viewerMoving = true;
        _this._miniMapMoving = false;

        // Keep a record of _this to prevent auto toggling when the user
        // explicitly doesn't want it.
        _this._userToggledDisplay = false;
        _this._minimized = false;

        if (this.options.toggleDisplay && this._isScreen==false) {
            this._addToggleButton();
        }

        _this._miniMap.whenReady(L.Util.bind(function () {
            var bounds = _this._getViewRange();
			if(bounds){
				_this._aimingRect = L.rectangle(bounds, _this.options.aimingRectOptions).addTo(_this._miniMap);
				_this._shadowRect = L.rectangle(bounds, _this.options.shadowRectOptions).addTo(_this._miniMap);
				if(_this._isScreen==true){
					this._aimingRect.setStyle({opacity: 0, fillOpacity: 0});
				}
				var camera = _this.viewer.scene.camera;
				
				camera.moveEnd.addEventListener(_this._moveEnd.bind(_this));			
				camera.moveStart.addEventListener(_this._moveStart.bind(_this));

				_this._miniMap.on('movestart', _this._onMiniMapMoveStarted, _this);
				_this._miniMap.on('move', _this._onMiniMapMoving, _this);
				_this._miniMap.on('moveend', _this._onMiniMapMoved, _this);
				
				if(_this.options.minimized==true && _this._isScreen==false)
					_this._toggleDisplayButtonClicked();
				_this._container.style.visibility='visible';
			}
            
        }, _this));

        return _this._container;
    },
	_moveEnd:function (e) {
		var _this = this;
				if(_this._miniMap){
					 var rect = _this._getViewRange();
					if (!_this._miniMapMoving) {
						_this._viewerMoving = true;
						if(rect){
							var zrect = _this._getZoomOutRange(rect);
							_this._miniMap.fitBounds(zrect);
							_this._setDisplay(_this._decideMinimized());
						}
						
					} else {
						_this._miniMapMoving = false;
					}
					if(rect)
						_this._aimingRect.setBounds(rect);
				}               
    },
	_moveStart:function (e) {
		var _this = this;
				if(_this._miniMap){
					var rect = _this._getViewRange();
					if(rect)
						_this._aimingRect.setBounds(rect);
				}
            },
    _addToggleButton: function () {
        this._toggleDisplayButton = this.options.toggleDisplay ? this._createButton(
            '', this._toggleButtonInitialTitleText(), ('leaflet-control-minimap-toggle-display leaflet-control-minimap-toggle-display-' +
                this.options.position), this._container, this._toggleDisplayButtonClicked, this) : undefined;
        // this._toggleDisplayButton.style.zIndex = 99999;
        this._toggleDisplayButton.style.width = this.options.collapsedWidth;
        this._toggleDisplayButton.style.height = this.options.collapsedHeight;
    },

    _toggleButtonInitialTitleText: function () {
        if (this.options.minimized) {
            return this.options.strings.showText;
        } else {
            return this.options.strings.hideText;
        }
    },

    _createButton: function (html, title, className, container, fn, context) {
        var link = L.DomUtil.create('a', className, container);
        link.innerHTML = html;
        link.href = '#';
        link.title = title;

        var stop = L.DomEvent.stopPropagation;

        L.DomEvent
            .on(link, 'click', stop)
            .on(link, 'mousedown', stop)
            .on(link, 'dblclick', stop)
            .on(link, 'click', L.DomEvent.preventDefault)
            .on(link, 'click', fn, context);

        return link;
    },

    _toggleDisplayButtonClicked: function () {
        this._userToggledDisplay = true;
        if (!this._minimized) {
            this._minimize();
        } else {
            this._restore();
        }
    },
    _showInitView: function () {
        var rect = this._getViewRange();
		if(rect){
			var zrect = this._getZoomOutRange(rect);
			this._miniMap.fitBounds(zrect);
		}
        
    },
    _setDisplay: function (minimize) {
        if (minimize !== this._minimized) {
            if (!this._minimized) {
                this._minimize();
            } else {
                this._restore();
            }
        }
    },
    _minimize: function () {
        // hide the minimap
        if (this.options.toggleDisplay) {
            this._container.style.width = this.options.collapsedWidth;
            this._container.style.height = this.options.collapsedHeight;
            this._toggleDisplayButton.className += (' minimized-' + this.options.position);
            this._toggleDisplayButton.title = this.options.strings.showText;
        } else {
            this._container.style.display = 'none';
        }
        this._minimized = true;
		this.options.minimized=true;
        this._onToggle();
    },
    _restore: function () {
        if (this.options.toggleDisplay) {
            this._container.style.width = this.options.width;
            this._container.style.height = this.options.height;
            this._toggleDisplayButton.className = this._toggleDisplayButton.className
                .replace('minimized-' + this.options.position, '');
            this._toggleDisplayButton.title = this.options.strings.hideText;
        } else {
            this._container.style.display = 'block';
        }
        this._minimized = false;
		this.options.minimized=false;
        this._onToggle();
    },
    _onMiniMapMoveStarted: function (e) {
        if (!this.options.centerFixed) {
            var lastAimingRect = this._aimingRect.getBounds();
            var sw = this._miniMap.latLngToContainerPoint(lastAimingRect.getSouthWest());
            var ne = this._miniMap.latLngToContainerPoint(lastAimingRect.getNorthEast());
            this._lastAimingRectPosition = { sw: sw, ne: ne };
        }
    },
    _onMiniMapMoving: function (e) {
        if (!this.options.centerFixed) {
            if (!this._viewerMoving && this._lastAimingRectPosition) {
                this._shadowRect.setBounds(new L.LatLngBounds(this._miniMap.containerPointToLatLng(this._lastAimingRectPosition.sw), this._miniMap.containerPointToLatLng(this._lastAimingRectPosition.ne)));
                this._shadowRect.setStyle(this._isScreen?{opacity: 0, fillOpacity: 0}:{ opacity: 1, fillOpacity: 0.3 });
            }
        }
    },
    _onMiniMapMoved: function (e) {
        if (!this._viewerMoving&&!this._minimized) {
            this._miniMapMoving = true;

            var rect = this._isScreen?this._miniMap.getBounds():this._shadowRect.getBounds();
            var west = rect.getWest();
            var east = rect.getEast();
            var north = rect.getNorth();
            var south = rect.getSouth();
            var destination = Cesium.Rectangle.fromDegrees(west, south, east, north);
			var centerPt=null;
			centerPt=Cesium.Rectangle.center(destination, centerPt);
			
			var viewer = this.viewer;			
			var camera = viewer.scene.camera;
			var cartographic=Cesium.Cartographic.fromCartesian(camera.position);
			var longitude = Cesium.Math.toDegrees(cartographic.longitude);
			var latitude = Cesium.Math.toDegrees(cartographic.latitude);			
			var currentHeight=this.viewer.scene.getHeight(longitude,latitude);
			destination.height=(cartographic.height-currentHeight)+this.viewer.scene.getHeight(Cesium.Math.toDegrees(centerPt.longitude),Cesium.Math.toDegrees(centerPt.latitude));;
            var orientation = {
                heading: Cesium.Math.toRadians(0),
                pitch:camera.pitch,//Cesium.Math.toRadians(-90),
                roll:camera.roll//0.0
            };
            this.viewer.scene.camera.setView({
                destination: destination,
                orientation: orientation
            });
			
			//获取当前地图范围
			/*var bounds = this._miniMap.getBounds();//map.getExtent();
			//根据给定的地图范围计算场景的高度
			var altitude = _calculateAltitudeFromBounds(bounds);
			//获取地图中心点
			var center = map.getCenter();
			//设置场景相机
			var camera = new SuperMap.Web.Realspace.Camera(center.lon, center.lat, altitude);
			camera.set_heading(0);
			sceneControl.get_scene().set_camera(camera);*/
			
            this._shadowRect.setStyle({ opacity: 0, fillOpacity: 0 });
        } else {
            this._viewerMoving = false;
        }
    },
    _isZoomLevelFixed: function () {
        var zoomLevelFixed = this.options.zoomLevelFixed;
        return this._isDefined(zoomLevelFixed) && this._isInteger(zoomLevelFixed);
    },
    _decideMinimized: function () {
        if (this._userToggledDisplay) {
            return this._minimized;
        }

        if (this.options.autoToggleDisplay) {
            var bounds = this._getViewRange();
            if (bounds.contains(this._miniMap.getBounds())) {
                return true;
            }
            return false;
        }

        return this._minimized;
    },
    _isInteger: function (value) {
        return typeof value === 'number';
    },
    _isDefined: function (value) {
        return typeof value !== 'undefined';
    },
    _onToggle: function () {
        L.Util.requestAnimFrame(function () {
            L.DomEvent.on(this._container, 'transitionend', this._fireToggleEvents, this);
            if (!L.Browser.any3d) {
                L.Util.requestAnimFrame(this._fireToggleEvents, this);
            }
        }, this);
    },
    _fireToggleEvents: function () {
        L.DomEvent.off(this._container, 'transitionend', this._fireToggleEvents, this);
    },
    _getViewRange: function () {
        var viewer = this.viewer;
		var bounds=null;
		if(viewer){
			var camera = viewer.scene.camera;
			var range = camera.computeViewRectangle();
			if(camera && range){
				var west=undefined,east=undefined,north=undefined,south=undefined;
				if(range.west !=undefined)
				   west = range.west / Math.PI * 180;
				if(range.east !=undefined)
				   east = range.east / Math.PI * 180;
				if(range.north !=undefined)
				   north = range.north / Math.PI * 180;
				if(range.south !=undefined)
				   south = range.south / Math.PI * 180;
				if(west!=undefined && east!=undefined && north!=undefined && south!=undefined)
					bounds = new L.LatLngBounds(
							new L.LatLng(north, west),
							new L.LatLng(south, east)
					);
			}	
		}       
        return bounds;
    },
    _getZoomOutRange: function (rect) {
        var west = rect.getWest();
        var east = rect.getEast();
        var north = rect.getNorth();
        var south = rect.getSouth();
		if(this._isScreen==false){
			var factor = 3.0;
			var xdis = Math.abs(east - west);
			var ydis = Math.abs(north - south);
			var xoff = xdis * (factor - 1) / 2.0;
			var yoff = ydis * (factor - 1) / 2.0;
			west -= xoff;
			east += xoff;
			north += yoff;
			south -= yoff;
		}else{
			//获取场景相机
			var viewer = this.viewer;
			var camera = viewer.scene.camera;
			var cartographic=Cesium.Cartographic.fromCartesian(camera.position);
			//获取场景高度		
			var altitude =cartographic.height;
			//获取经度
			var longitude = Cesium.Math.toDegrees(cartographic.longitude);
			//获取纬度
			var latitude = Cesium.Math.toDegrees(cartographic.latitude);
			//根据给定的场景高度计算地图中显示范围的宽度
			var size = this._calculateSizeFromAltitude(altitude);
			size = size * 0.19;
			west=longitude - size;
			east=longitude + size;
			north=latitude + size;
			south=latitude - size;
			
		}       
		
        if (west < -180) {
            west = -180;
        }
        if (east > 180) {
            east = 180;
        }
        if (north > 90) {
            north = 90;
        }
        if (south < -90) {
            south = -90;
        }
        var bounds = new L.LatLngBounds(
            new L.LatLng(north, west),
            new L.LatLng(south, east)
        );
        return bounds;
    },
	/// <summary>
	/// 根据给定的场景高度计算地图中显示范围的宽度
	/// </summary>
	/// <param name="altitude">场景高度</param>
	/// <returns>地图显示范围尺寸</returns>
	_calculateSizeFromAltitude(altitude) {
		var _PI = 3.1415926;
		var _earthRadius = 6378137;
		var size;
		if (altitude >= _earthRadius) {//当场景高度大于可全幅显示整球的高度时
			var ratio = (altitude + _earthRadius) * 0.5;
			size = 120 * ratio / _earthRadius
		}
		else {//当场景高度小于可全幅显示整球的高度时，即无法看到整球时
			var tan30 = Math.tan(_PI / 6);
			//设置方程组的a,b,c
			var a = (Math.pow(tan30, 2) + 1) * Math.pow(_earthRadius, 2);
			var b = -2 * (_earthRadius + altitude) * _earthRadius * Math.pow(tan30, 2);
			var c = Math.pow(tan30, 2) * Math.pow(_earthRadius + altitude, 2) - Math.pow(_earthRadius, 2.0);
			//解一元二次方程，取锐角，因此余弦值较大
			var cosd = (-b + Math.sqrt(Math.pow(b, 2) - 4 * a * c)) / (2 * a);
			var d = Math.acos(cosd);
			var widthd = 2 * d * _earthRadius;
			size = (widthd / (_PI * _earthRadius)) * 180;
		}
		return size;
	},
	/// <summary>
	/// 根据给定的地图范围计算场景的高度
	/// </summary>
	/// <param name="bounds">地图范围</param>
	/// <returns>场景高度</returns>
	_calculateAltitudeFromBounds(bounds) {
		var _PI = 3.1415926;
		var _earthRadius = 6378137;
		var altitude = _earthRadius;
		//var boundsWidth = bounds.right - bounds.left;
		var boundsWidth = bounds.getEast() - bounds.getWest();
		if (boundsWidth >= 120) {
			altitude = _earthRadius * boundsWidth / 60 - _earthRadius;
		}
		else if (boundsWidth != 0) {
			var angle1 = (boundsWidth / 360) * _PI;
			var height = Math.sin(angle1) * _earthRadius;
			var a = height / Math.tan(angle1);
			var b = height / Math.tan(_PI / 6);
			altitude = a + b - _earthRadius;
		}
		return altitude;
	},	
    addPipeLayers :function (url, subLayers) {
        this.createTempLayer(url, subLayers);
    },
    getLayerStatusList: function (subLayers) {
            var parameters = new SuperMap.SetLayerStatusParameters();
            for (var i = 0; i < subLayers.length; i++) {
                var layerStatus = new SuperMap.LayerStatus();                
                layerStatus.layerName = subLayers[i].name;
                layerStatus.isVisible = eval(subLayers[i].visible);
				parameters.layerStatusList.push(layerStatus);
            }
			parameters.holdTime=30;
            return parameters;
    },
    createTempLayer:function (url, subLayers) {           
        var layerStatusParameters = this.getLayerStatusList(subLayers);
        L.supermap.layerInfoService(url).setLayerStatus(layerStatusParameters, function (createTempLayerEventArgs) {
            var tempLayerID = createTempLayerEventArgs.result.newResourceID;
			if(this.pipeLayerObj){
				this._miniMap.removeLayer(this.pipeLayerObj);
			}
            this.pipeLayerObj=L.supermap.tiledMapLayer(url, { layersID: tempLayerID });
			this.pipeLayerObj.addTo(this._miniMap);
        }.bind(this));
    },
    CLASS_NAME: "CesiumOverviewMapControl"
};