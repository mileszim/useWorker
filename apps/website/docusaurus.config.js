module.exports = {
  title: 'useWorker',
  tagline: 'Use web workers with react hook',
  url: 'https://mileszim.github.io',
  baseUrl: '/useWorker',
  favicon: 'img/favicon.ico',
  organizationName: 'mileszim',
  projectName: 'useWorker',
  themeConfig: {
    navbar: {
      title: 'useWorker',
      logo: {
        alt: 'useWorker',
        src: 'img/gear.png',
      },
      items: [
        {
          to: 'docs/introduction',
          activeBasePath: 'docs',
          label: 'Docs',
          position: 'left',
        },
        {
          href: 'https://github.com/mileszim/useWorker',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'introduction',
              to: 'docs/introduction',
            },
            {
              label: 'Installation',
              to: 'docs/installation',
            },
            {
              label: 'API',
              to: 'docs/api-useworker',
            },
            {
              label: 'Examples',
              to: 'docs/examples/examples-sort',
            },
            {
              label: 'Limitations',
              to: 'docs/limitations',
            },
          ],
        },
        {
          title: 'Social',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/mileszim/useworker',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()}, Built with Docusaurus.`,
    },
    prism: {
      defaultLanguage: 'js',
      plugins: ['line-numbers', 'show-language'],
    },
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/mileszim/useworker/edit/master/website/',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],
}
