// @flow

import spawn from 'cross-spawn';
import pathExists from 'path-exists';
import path from 'path';
import log from '../util/log';

type RunResult = {
  code: number,
  args: Array<string>
};

export default (async function localCli(
	commandLineArgs: Array<string>,
	options?: any = {}
): Promise<RunResult> {

  let spawnOpts = {};
  if (options.silent) {
    spawnOpts.silent = true;
  } else {
    spawnOpts.stdio = 'inherit';
  }

	// TODO MTE: revisit if we need remove dependency on 'react-native' (i.e. invoke local cli directly)
  const proc = spawn('react-native', commandLineArgs, spawnOpts);
  return new Promise(resolve => {
    proc.on('close', code => resolve({ code, commandLineArgs }));
	});
});
