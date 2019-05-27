const YamahaAPI = require('yamaha-nodejs');
const fetch = require('node-fetch');
// https://github.com/christianfl/av-receiver-docs/

let Service;
let Characteristic;

// --== MAIN SETUP ==--
function YamahaVolumePlatform(log, config) {
  this.log = log;
  this.config = config;

  // create the Yamaha API instance
  this.YAMAHA = new YamahaAPI(config.ip);
}

/* Initialise Yamaha AVR Accessory */
function YamahaVolumeAccessory(log, config, yamaha, sysConfig, inputs) {
  this.log = log;

  // Configuration
  this.YAMAHA = yamaha;
  this.config = config;
  this.sysConfig = sysConfig;
  this.name = config.name || 'Yamaha AVR';
  this.inputs = inputs;
  this.enabledServices = [];
  this.playing = true;

  // Check & Update Accessory Status every 5 seconds
  this.checkStateInterval = setInterval(
    this.checkAVRState.bind(this, this.updateAVRState.bind(this)),
    5000,
  );
}

module.exports = (homebridge) => {
  ({ Service, Characteristic } = homebridge.hap);
  homebridge.registerPlatform('homebridge-yamaha-volume', 'yamaha-volume', YamahaVolumePlatform);
};

YamahaVolumePlatform.prototype = {
  accessories(callback) {
    // Get Yamaha System Configuration
    this.YAMAHA.getSystemConfig().then(
      (sysConfig) => {
        if (sysConfig && sysConfig.YAMAHA_AV) {
          // Create the Yamaha AVR Accessory
          if (this.config.inputs) {
            callback([
              new YamahaVolumeAccessory(
                this.log,
                this.config,
                this.YAMAHA,
                sysConfig,
                this.config.inputs,
              ),
            ]);
          } else {
            // If no inputs defined in config - set available inputs as returned from receiver
            this.YAMAHA.getAvailableInputs().then((availableInputs) => {
              callback([
                new YamahaAVRAccessory(
                  this.log,
                  this.config,
                  this.YAMAHA,
                  sysConfig,
                  availableInputs,
                ),
              ]);
            });
          }
        }
      },
      (ERROR) => {
        this.log(`ERROR: Failed getSystemConfig from ${this.config.name} probably just not a Yamaha AVR.`, ERROR);
      },
    );
  },
};

YamahaVolumeAccessory.prototype = {
  /* Services */
  getServices() {
    this.log(`Initialised ${this.name}`);

    // Services
    this.informationService();
    this.volumeUpService();
    this.volumeDownService();

    return this.enabledServices;
  },


  volumeUpService() {
    this.switchService = new Service.Switch("Volume Up", "up");
    
    this.direction = 0;
    
    this.switchService
      .getCharacteristic(Characteristic.On)
      .on('get', function(callback, context) {
        callback(false, false);
      }.bind(this))
      .on('set', (this.direction, callback) => {
        this.setVolume(this.direction, callback);
      })
      .getValue(null, null); // force an asynchronous get
  },

  volumeDownService() {
    this.switchService = new Service.Switch("Volume Down", "down");
    
    this.direction = 1;
    
    this.switchService
      .getCharacteristic(Characteristic.On)
      .on('get', function(callback, context) {
        callback(false, false);
      }.bind(this))
      .on('set', (this.direction, callback) => {
        this.setVolume(this.direction, callback);
      })
      .getValue(null, null); // force an asynchronous get
  },



  informationService() {
    // Create Information Service
    this.informationService = new Service.AccessoryInformation();
    this.informationService
      .setCharacteristic(Characteristic.Name, this.name)
      .setCharacteristic(Characteristic.Manufacturer, 'Yamaha')
      // .setCharacteristic(Characteristic.FirmwareRevision, require('./package.json').version)
      .setCharacteristic(Characteristic.Model, this.sysConfig.YAMAHA_AV.System[0].Config[0].Model_Name[0])
      .setCharacteristic(Characteristic.SerialNumber, this.sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0]);

    this.enabledServices.push(this.informationService);
  },


  setVolume(direction, callback) {
    this.YAMAHA.getBasicInfo().done((basicInfo) => {
      const volume = basicInfo.getVolume();

      if (direction === 0) {
        this.log('Volume Up', (volume + 5) / 10);
        this.YAMAHA.volumeUp(5);
      } else {
        this.log('Volume Down', (volume - 5) / 10);
        this.YAMAHA.volumeDown(5);
      }

      callback();
    });
  
};
