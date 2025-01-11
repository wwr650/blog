interface ISiteMetadataResult {
  siteTitle: string;
  siteUrl: string;
  description: string;
  logo: string;
  navLinks: {
    name: string;
    url: string;
  }[];
}

const data: ISiteMetadataResult = {
  siteTitle: 'Running Page',
  siteUrl: '',
  logo: '',
  description: 'Personal site and blog',
  navLinks: [
    {
      name: 'Blog',
      url: 'https://wwr650.github.io/',
    },
    {
      name: 'About',
      url: 'https://github.com/wwr650/running_page/blob/master/README-CN.md',
    },
  ],
};

export default data;
