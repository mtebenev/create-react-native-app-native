// @flow

import chalk from 'chalk';
import fse from 'fs-extra';
import path from 'path';
import pathExists from 'path-exists';
import spawn from 'cross-spawn';
import minimist from 'minimist';
import yeoman from 'yeoman-environment';
import log from '../util/log';
import install from '../util/install';
import localCli from '../util/localCli';

import { hasYarn } from '../util/pm';

// UPDATE DEPENDENCY VERSIONS HERE
const DEFAULT_DEPENDENCIES = {
	"react": "16.4.0",
	"react-native": "0.55.4",
	"react-native-windows": "0.55.0-rc.0"
};

// TODO figure out how this interacts with ejection
const DEFAULT_DEV_DEPENDENCIES = {
	"@types/jest": "22.2.3",
	"@types/react": "16.3.14",
	"@types/react-native": "0.55.15",
	"@types/react-test-renderer": "16.0.1",
	"babel-jest": "23.0.0",
	"babel-preset-react-native": "4.0.0",
	"jest": "23.0.0",
	"react-addons-test-utils": "15.6.2",
	"react-native-mock": "0.3.1",
	"react-native-typescript-transformer": "1.2.8",
	"react-test-renderer": "16.4.0",
	"rnpm-plugin-windows": "0.2.8",
	"ts-jest": "22.4.6",
	"typescript": "2.8.3"
};

const arg = minimist(process.argv.slice(2), {
  boolean: ['with-web-support'],
});

module.exports = async (appPath: string, appName: string, verbose: boolean, cwd: string = '') => {

	const useYarn: boolean = hasYarn(appPath);
  const npmOrYarn = useYarn ? 'yarn' : 'npm';

  if (!useYarn) {
    let npmVersion = spawn.sync('npm', ['--version']).stdout.toString().trim();
    let npmVersionParts = npmVersion.split('.');
    let majorVersion = parseInt(npmVersion[0], 10);
    let minorVersion = parseInt(npmVersion[1], 10);
    let patchVersion = parseInt(npmVersion[2], 10);

    if (majorVersion === 5 && minorVersion < 7) {
      console.log(
        chalk.yellow(
          `
*******************************************************************************
ERROR: npm >= 5.0.0 and < 5.7.0 are not supported
*******************************************************************************

It looks like you're using a version of npm that is buggy with this tool.

We recommend using npm >= 5.7.0 or yarn.

*******************************************************************************
 `
        )
      );
      process.exit(1);
    }
  }

  const readmeExists: boolean = await pathExists(path.join(appPath, 'README.md'));
  if (readmeExists) {
    await fse.rename(path.join(appPath, 'README.md'), path.join(appPath, 'README.old.md'));
  }

  const appPackagePath: string = path.join(appPath, 'package.json');
  const appPackage = JSON.parse(await fse.readFile(appPackagePath));

  // mutate the default package.json in any ways we need to
  appPackage.scripts = {
    start: 'node node_modules/react-native/local-cli/cli.js start',
    test: 'jest',
  };

  appPackage.jest = {
    preset: 'react-native',
  };

  if (!appPackage.dependencies) {
    appPackage.dependencies = {};
  }

  if (!appPackage.devDependencies) {
    appPackage.devDependencies = {};
  }

  // react-native-scripts is already in the package.json devDependencies
  // so we need to merge instead of assigning
  Object.assign(appPackage.dependencies, DEFAULT_DEPENDENCIES);
  Object.assign(appPackage.devDependencies, DEFAULT_DEV_DEPENDENCIES);

  // Write the new appPackage after copying so that we can include any existing
  await fse.writeFile(appPackagePath, JSON.stringify(appPackage, null, 2));

	// Install packages
  const { code, command, args } = await install(appPath);
  if (code !== 0) {
    console.error('Failed to install');
    // console.error(`\`${command} ${args.join(' ')}\` failed`);
    return;
	}

	// Run default RN generators
	const rnLocalCliModulePath = path.resolve(
		process.cwd(),
		'node_modules',
		'react-native',
		'local-cli',
		'generator',
		'templates.js');

	const {
		listTemplatesAndExit,
		createProjectFromTemplate,
	} = require(rnLocalCliModulePath);

	createProjectFromTemplate(process.cwd(), appName, undefined, undefined);

	// Run RN Windows generator (use app name for namespace)
	const generatorWindowsPath = path.resolve(
		process.cwd(),
		'node_modules',
		'react-native-windows',
		'local-cli',
		'generator-windows');

	const yeomanEnv = yeoman.createEnv();
	yeomanEnv.register(generatorWindowsPath, 'react:windows');
	const generatorWindowsArgs = ['react:windows', appName, appName];
	yeomanEnv.run(generatorWindowsArgs, { ns: appName, verbose: false}, async () => {
		removeRedundantFiles(appPath);
		await copyTemplateFiles(appPath);
		await updateIndexJs(appPath, appName);
		logFinalMessage(appPath, appName, npmOrYarn);
	});
};

/**
 * Removes some of files created by standard generators
 * RN always copies default template files: https://github.com/facebook/react-native/blob/a90d0e3614c467c33cf85bcbe65be71903d5aecc/local-cli/generator/templates.js#L63
 * RNW always creates App.windows.js file
 */
function removeRedundantFiles(appPath) {

	const filesToRemove = [
		'App.windows.js',
		'App.js'
	];

	filesToRemove.forEach(f => {
		let filePath = path.join(appPath, f);
		fse.removeSync(filePath);
	});
}

async function copyTemplateFiles(appPath: string) {

	const ownPackageName: string = require('../../package.json').name;
  const ownPath: string = path.join(appPath, 'node_modules', ownPackageName);

	// Copy the files for the user
  await fse.copy(path.join(ownPath, 'template'), appPath);

  // Rename gitignore after the fact to prevent npm from renaming it to .npmignore
  try {
    await fse.rename(path.join(appPath, 'gitignore'), path.join(appPath, '.gitignore'));
  } catch (err) {
    // Append if there's already a `.gitignore` file there
    if (err.code === 'EEXIST') {
      const data = await fse.readFile(path.join(appPath, 'gitignore'));
      await fse.appendFile(path.join(appPath, '.gitignore'), data);
      await fse.unlink(path.join(appPath, 'gitignore'));
    } else {
      throw err;
    }
	}
}

/**
 * We have to put correct app name for registration
 */
async function updateIndexJs(appPath: string, appName: string) {

	const indexJsPath = path.join(appPath, 'index.js');
	let content = await fse.readFile(indexJsPath, 'utf8');
	content = content.replace(/%%APP_NAME%%/g, appName);

	await fse.writeFile(indexJsPath, content, 'utf8');
}

/**
 * Prints final message after all generators executed
 */
function logFinalMessage(appPath, appName, npmOrYarn) {
  // display the cleanest way to get to the app dir
  // if the cwd + appName is equal to the full path, then just cd into appName
  let cdpath;
  if (path.resolve(process.cwd(), appName) === appPath) {
    cdpath = appName;
  } else {
    cdpath = appPath;
  }

  log(
    `
Success! Created ${appName} at ${appPath}
Use react-native tools for development.

Read more info at: https://facebook.github.io/react-native/docs/getting-started.html#the-react-native-cli-1

`);
}
