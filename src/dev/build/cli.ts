/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 * Any modifications Copyright OpenSearch Contributors. See
 * GitHub history for details.
 */

/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { resolve } from 'path';

import dedent from 'dedent';
import chalk from 'chalk';

import { buildDistributables } from './build_distributables';
import { isErrorLogged } from './lib';
import { readCliArgs } from './args';

// ensure the cwd() is always the repo root
process.chdir(resolve(__dirname, '../../../'));

const { showHelp, unknownFlags, log, buildOptions } = readCliArgs(process.argv);

if (unknownFlags.length) {
  const pluralized = unknownFlags.length > 1 ? 'flags' : 'flag';
  log.error(`Unknown ${pluralized}: ${unknownFlags.join(', ')}}`);
}

if (showHelp) {
  log.write(
    dedent(chalk`
      {dim usage:} node scripts/build

      build the OpenSearch Dashboards distributable

      options:
        --skip-archives         {dim Don't produce tar/zip archives}
        --skip-os-packages      {dim Don't produce rpm/deb/docker packages}
        --all-platforms         {dim Produce archives for all platforms, not just this one}
        --linux                 {dim Produce archives for only linux x64 platform}
        --linux-arm             {dim Produce archives for only linux arm64 platform}
        --darwin                {dim Produce archives for only darwin x64 platform}
        --rpm                   {dim Only build the rpm package}
        --deb                   {dim Only build the deb package}
        --docker                {dim Only build the docker image}
        --skip-docker-ubi       {dim Don't build the docker ubi image}
        --release               {dim Produce a release-ready distributable}
        --version-qualifier     {dim Suffix version with a qualifier}
        --skip-node-download    {dim Reuse existing downloads of node.js}
        --verbose,-v            {dim Turn on verbose logging}
        --no-debug              {dim Turn off debug logging}
    `) + '\n'
  );
  process.exit(1);
}

buildDistributables(log, buildOptions!).catch((error) => {
  if (!isErrorLogged(error)) {
    log.error('Uncaught error');
    log.error(error);
  }

  process.exit(1);
});
