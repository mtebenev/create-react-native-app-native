# `react-native-scripts-native`

This is another fork of create-react-native-app

Create React Native applications with native toolchain using create-react-native-app scripts.

The differences are:
* No Expo usage. The script creates application with the native toolchain
* Creates TypeScript application
* Adds support for Windows apps (UWP)


```sh
$ npm install -g react-native-cli
$ npx create-react-native-app my-app --scripts-version=react-native-scripts-native
```

Why this script exists
----------------------

create-react-native-app is great but it works entirely on Expo toolchain. If you need TypeScript + Windows + Native modules then this scris can be useful for you.
Read more at https://docs.expo.io/versions/v27.0.0/introduction/why-not-expo

Developing Windows app (UWP, Visual Studio)
-------------------------------------------
1. Open solution in Visual Studio, select appropriate build configuration and launch
2. Launch the following in console:
```sh
react-native start
```

Get more information at [React-Native-Windows page](https://github.com/Microsoft/react-native-windows/blob/master/docs/GettingStarted.md)

Developing Windows app (UWP, command line)
-------------------------------------------
```sh
react-native run-windows
```

Developing Android app
-------------------------------------------
```sh
react-native run-android
```

Related links
----------------------------
https://github.com/react-community/create-react-native-app - code base
https://github.com/Microsoft/react-native-windows - Windows support for React Native by Microsoft
https://github.com/Microsoft/TypeScript-React-Native-Starter - starter TypeScript template for RN app
https://github.com/mathieudutour/create-react-native-app-typescript - another fork adding TypeScript support with Expo toolchain

