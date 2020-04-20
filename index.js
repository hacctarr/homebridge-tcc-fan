// This platform integrates Honeywell TCC's Fan into homebridge
// As I only own single thermostat, so this only works with one, but it is
// conceivable to handle mulitple with additional coding.
//
// The configuration is stored inside the ../config.json
// {
//     "platform": "tcc",
//     "name":     "Fan",
//     "username" : "username/email",
//     "password" : "password",
//     "debug" : "True",      - Optional
//     "refresh": "60",       - Optional
//     "devices" : [
//        { "deviceID": "123456789", "name" : "Main Floor Thermostat" },
//        { "deviceID": "123456789", "name" : "Upper Floor Thermostat" }
//     ]
// }
//

/*jslint node: true */
'use strict';

var tcc = require('./lib/tcc.js');
var Accessory, Service, Characteristic, UUIDGen, CommunityTypes;

var myAccessories = [];
var session; // reuse the same login session
var updating; // Only one change at a time!!!!

module.exports = function (homebridge) {

    Accessory = homebridge.platformAccessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;

    homebridge.registerPlatform("homebridge-tcc-fan", "tcc-fan", tccPlatform);
}

function tccPlatform(log, config, api) {

    this.username = config['username'];
    this.password = config['password'];
    this.refresh = config['refresh'] || 60; // Update every minute
    this.debug = config['debug'] || false;
    this.log = log;
    this.devices = config['devices'];

    this.showCirculate = config['showCirculate'] || false;
    this.showFollowSchedule = config['showFollowSchedule'] || false;

    updating = false;
}

tccPlatform.prototype = {
    accessories: function (callback) {
        this.log("Logging into tcc...");
        var that = this;

        tcc.setCharacteristic(Characteristic);
        tcc.setDebug(this.debug);

        tcc.login(that.username, that.password).then(function (login) {
            this.log("Logged into tcc!", this.devices);
            session = login;

            let requests = this.devices.map((device) => {
                return new Promise((resolve) => {

                    session.CheckDataSession(device.deviceID,
                        function (err, deviceData) {
                            if (err) {
                                that.log("Create Device Error", err);
                                resolve();
                            } else {

                                var newAccessory = new tccAccessory(that.log, device.name,
                                    deviceData, that.username, that.password, device.deviceID, that.debug,
                                    that.showCirculate, that.showFollowSchedule);
                                // store accessory in myAccessories
                                myAccessories.push(newAccessory);
                                resolve();
                            }
                        });
                });
            })

            // Need to wait for all devices to be configured

            Promise.all(requests).then(() => {
                callback(myAccessories);
                that.periodicUpdate();
                setInterval(that.periodicUpdate.bind(this), this.refresh * 1000);

            });

            // End of login section
        }.bind(this)).fail(function (err) {
            // tell me if login did not work!
            that.log("Error during Login:", err);
            callback(err);
        });
    }
};

function updateStatus(that, service, data) {
    // var that = this;
    // if (that.device.latestData.hasFan && that.device.latestData.fanData && that.device.latestData.fanData.fanModeOnAllowed) {
    if (data.hasFan && data.fanData && data.fanData.fanModeOnAllowed) {
        service.getCharacteristic(Characteristic.On).getValue();
    }


}

tccPlatform.prototype.periodicUpdate = function (t) {
    this.log("periodicUpdate");
    var t = updateValues(this);
}

function updateValues(that) {
    that.log("updateValues", myAccessories.length);
    myAccessories.forEach(function (accessory) {

        session.CheckDataSession(accessory.deviceID, function (err, deviceData) {
            if (err) {
                that.log("ERROR: UpdateValues", accessory.name, err);
                that.log("updateValues: Device not reachable", accessory.name);
                accessory.newAccessory.updateReachability(false);
                tcc.login(that.username, that.password).then(function (login) {
                    that.log("Logged into tcc!");
                    session = login;
                }.bind(this)).fail(function (err) {
                    // tell me if login did not work!
                    that.log("Error during Login:", err);
                });
            } else {
                if (that.debug)
                    that.log("Update Values", accessory.name, deviceData);
                // Data is live

                if (deviceData.deviceLive) {
                    //                    that.log("updateValues: Device reachable", accessory.name);
                    accessory.newAccessory.updateReachability(true);
                } else {
                    that.log("updateValues: Device not reachable", accessory.name);
                    accessory.newAccessory.updateReachability(false);
                }

                if (!tcc.deepEquals(deviceData, accessory.device)) {
                    that.log("Change", accessory.name, tcc.diff(accessory.device, deviceData));
                    accessory.device = deviceData;
                    updateStatus(that, accessory.fanService, deviceData);

                } else {
                    that.log("No change", accessory.name);
                }
            }
        });
    });
}

// give this function all the parameters needed

function tccAccessory(log, name, deviceData, username, password, deviceID, debug, showCirculate, showFollowSchedule) {

    var uuid = UUIDGen.generate(name);

    this.newAccessory = new Accessory(name, uuid);

    //    newAccessory.name = name;

    this.log = log;
    this.log("Adding TCC Device", name, deviceID);
    this.name = name;
    this.device = deviceData;
    this.device.deviceLive = "false";
    this.username = username;
    this.password = password;
    this.deviceID = deviceID;
    this.debug = debug;
    this.showCirculate = showCirculate;
    this.showFollowSchedule = showFollowSchedule;

    //    return newAccessory;
}

tccAccessory.prototype = {

    getName: function (callback) {

        var that = this;
        that.log("requesting name of", this.name);
        callback(this.name);

    },

    setState: function (value, callback) {
        var that = this;
        if (!updating) {
            updating = true;

            that.log("Setting fan switch for", this.name, "to", value);
            // TODO:
            // verify that the task did succeed

            tcc.login(this.username, this.password).then(function (session) {
                session.setFanSwitch(that.deviceID, value).then(function (taskId) {
                    that.log("Successfully changed system!");
                    that.log(taskId);
                    // Update all information
                    // TODO: call periodicUpdate to refresh all data elements
                    updateValues(that);
                    callback(null, Number(1));
                });
            }).fail(function (err) {
                that.log('tcc Failed:', err);
                callback(null, Number(0));
            });
            callback(null, Number(0));
            updating = false
        }
    },

    getState: function (callback) {
        var that = this;

        // Homekit allowed values
        //         Characteristic.TargetFanState.MANUAL = 0;
        //         Characteristic.TargetFanState.AUTO = 1;

        var TargetFanState = tcc.toHomeBridgeFanSystem(this.device.latestData.fanData.fanMode);

        this.log("getTargetFanState is ", TargetFanState, this.name);

        callback(null, Boolean(TargetFanState));
    },

    getServices: function () {
        var that = this;
        that.log("getServices", this.name);
        // Information Service
        var informationService = new Service.AccessoryInformation();

        informationService
            .setCharacteristic(Characteristic.Identify, this.name)
            .setCharacteristic(Characteristic.Manufacturer, "Honeywell")
            .setCharacteristic(Characteristic.Model, this.model)
            .setCharacteristic(Characteristic.Name, this.name)
            .setCharacteristic(Characteristic.SerialNumber, this.deviceID); // need to stringify the this.serial

        const returnServices = [];
        returnServices.push(informationService);

        // Fan Service
        this.fanService = new Service.Fan(this.name);
        this.fanService
            .getCharacteristic(Characteristic.Name)
            .on('get', this.getName.bind(this));

        if (this.device.latestData.hasFan && this.device.latestData.fanData && this.device.latestData.fanData.fanModeOnAllowed) {
            this.fanService
                .getCharacteristic(Characteristic.On)
                .on('get', this.getState.bind(this))
                .on('set', this.setState.bind(this));
            
            returnServices.push(this.fanService);

            if (this.showCirculate) {
                this.log("Adding switch for \'Circulate\'...");
                this.myMomemtarySwitchCirculate = new Service.Switch("Circulate", "mode-circulate");
                this.myMomemtarySwitchCirculate
                    .getCharacteristic(Characteristic.On)
                    .on("get", (callback) => {
                        callback(false)
                    })
                    .on("set", (s, callback) => {
                        if (s === true) {
                            if (myAccessories && myAccessories[0]) {
                                myAccessories[0].setState(2, callback);
                            }
                            // reset switch to off
                            setTimeout(function () {
                                this.myMomemtarySwitchCirculate.setCharacteristic(Characteristic.On, false);
                            }.bind(this), 500);
                        } else {
                            callback(null, s);
                        }
                    });
                this.log("\'Circulate\' switch added!");
                returnServices.push(this.showFollowSchedule);
            }

            if (this.showFollowSchedule) {
                this.log("Adding switch for \'Follow Schedule\'...")
                this.myMomemtarySwitchFollowSchedule = new Service.Switch("Follow Schedule", "mode-follow-schedule");
                this.myMomemtarySwitchFollowSchedule
                    .getCharacteristic(Characteristic.On)
                    .on("get", (callback) => {
                        callback(false)
                    })
                    .on("set", (s, callback) => {
                        if (s === true) {
                            if (myAccessories && myAccessories[0]) {
                                myAccessories[0].setState(3, callback);
                            }
                            // reset switch to off
                            setTimeout(function () {
                                this.myMomemtarySwitchFollowSchedule.setCharacteristic(Characteristic.On, false);
                            }.bind(this), 500);
                        } else {
                            callback(null, s);
                        }
                    });
                this.log("\'Follow Schedule\' switch added!");
                returnServices.push(this.myMomemtarySwitchFollowSchedule);
            }

        }

        return returnServices;
    }
}
