# homebridge-tcc-fan

[![NPM Downloads](https://img.shields.io/npm/dm/homebridge-tcc-fan.svg?style=flat)](https://npmjs.org/package/homebridge-tcc-fan)

This is a plugin specifically for the Fan control in the Honeywell Total 
Connect Comfort thermostat. HomeKit does not support independent fan 
control within a Thermostat service. I had intended to enhance 
homebridge-tcc, but had to implement this as a separate platform instead.

# Devices Tested With

* RTH8580WF
* RTH9580

# Installation

1. Install homebridge using: npm install -g homebridge <br>
2. Install this plugin using npm install -g homebridge-tcc-fan
3. Update your configuration file. See sample-config below for a sample.

# Configuration Sample

```
"platforms": [
       {
            "platform": "tcc-fan",
            "name" : "Fan",
            "username" : ".....",
            "password" : ".....",
            "devices" : [
                  {"deviceID": "1234567","name": "Other Floor"},
                  {"deviceID": "abcdefg","name": "Main Floor"}
          	]
        },
    ]
```

- platform: tcc-fan
- name: can be anything you want
- username: your Honeywell e-mail
- password: your Honeywell password
- deviceID: Your honeywell deviceID Go to the Honeywell Total Connect Comfort website, log in and open your
device. Now look in the address bar and you will see something like:

https://mytotalconnectcomfort.com/portal/Device/Control/1234567

The last part is your Device ID.
- debug: optional parameter, will return details in log around response from TCC,
use full for debugging no response errors.
- refresh: How often the data is refreshed from the TCC website, in seconds.  Defaults to 60

# Roadmap

- None

# Notes

It seems to be vitally important to set the right system time, especially on raspi!
TCC only responds to requests with a current unixtime

# Credits

- NorthernMan54 - Borrowed your awesome homebridge-tcc plugin as the foundation of this plugin
- luc-ass - Borrowed your homebridge-evohome plugin as a base to start from
- Dan / Ghostbit - Borrowed your python script for the page flow of the TCC website
- bwdeleeuw - Fahrenheit testing and other enhancements
- devbymike - Validation of RTH9580
