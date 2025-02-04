const axios = require('axios');
const cheerio = require('cheerio');
const core = require('@actions/core');

// Устанавливаем фиксированные значения
const version = '24.10.0';
const target = 'ramips';
const baseUrl = `https://downloads.openwrt.org/releases/${version}/targets/${target}/`;

async function fetchHTML(url) {
  try {
    const { data } = await axios.get(url);
    return cheerio.load(data);
  } catch (error) {
    console.error(`Error fetching HTML for ${url}: ${error}`);
    throw error;
  }
}

async function getSubtargets() {
  const $ = await fetchHTML(baseUrl);
  const subtargets = [];
  $('table tr td.n a').each((index, element) => {
    const name = $(element).attr('href');
    if (name && name.endsWith('/')) {
      subtargets.push(name.slice(0, -1));
    }
  });
  return subtargets;
}

async function getDetails(subtarget) {
  const packagesUrl = `${baseUrl}${subtarget}/packages/`;
  const $ = await fetchHTML(packagesUrl);
  let vermagic = '';
  let pkgarch = '';

  $('a').each((index, element) => {
    const name = $(element).attr('href');
    if (name && name.startsWith('kernel_')) {
      const vermagicMatch = name.match(/kernel_\d+\.\d+\.\d+(?:-\d+)?[-~]([a-f0-9]+)(?:-r\d+)?_([a-zA-Z0-9_-]+)\.ipk$/);
      if (vermagicMatch) {
        vermagic = vermagicMatch[1];
        pkgarch = vermagicMatch[2];
      }
    }
  });

  return { vermagic, pkgarch };
}

async function main() {
  try {
    const subtargets = await getSubtargets();
    const jobConfig = [];

    for (const subtarget of subtargets) {
      const { vermagic, pkgarch } = await getDetails(subtarget);
      
      jobConfig.push({
        tag: version,
        target,
        subtarget,
        vermagic,
        pkgarch,
      });
    }

    core.setOutput('job-config', JSON.stringify(jobConfig));
  } catch (error) {
    core.setFailed(error.message);
  }
}

main();
