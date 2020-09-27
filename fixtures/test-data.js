module.exports = {
    plainCss: `
    .alert {
      position: relative;
      padding: 1.6rem 4.6rem;
      margin-bottom: 1.6rem;
      border: 1px solid #FAD0D0;
      color: #fff;
      border-radius: 0.2rem;
      width: 100%;
    } 
    
    .guest-layout__logo {
      margin-bottom: 1.6rem;
      min-height: 4rem;
      display: flex;
      justify-content: center;
    }
    
    .guest-layout__container {
      background: #ffffff;
      border: 1px solid #e5e5e5;
      border-radius: 0.2rem;
    } 
    
    .guest-layout {
      margin: 8rem auto;
      max-width: fit-content;
    }
    
    .guest-layout__header {
      font-weight: 400;
      font-size: 2rem;
      line-height: 3rem;
      letter-spacing: 0.03rem;
      padding: 2.4rem;
      border-bottom: 1px solid #e5e5e5;
    }
    
    .guest-layout__footer {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-direction: row-reverse;
      padding: 2.4rem 3rem;
      border-top: 1px solid #e5e5e5;
    }
    
    .guest-layout__footer--compact {
      border: none;
      padding: 0;
      margin-top: 1.6rem;
    }
    
    .guest-layout__content {
      display: flex;
      flex-wrap: nowrap;
      width: 38rem;
    }
    
    .guest-layout__content--with-side-content {
      width: 76rem;
    }
    .guest-layout__content--with-side-contentdfdf {
      width: 50%;
    }
    
    .guest-layout__content--with-side-contentdfdf {
      width: 50%;
    }
    .guest-layout__content--with-separatordfdfdf{
      border-right: 1px solid #e5e5e5;
    }
    .guest-layout__content-inner {
      width: 100%;
      display: flex;
      justify-content: center;
      flex-direction: column;
      margin: 0;
      padding: 3rem;
    }
    
    .guest-layout__content--with-separatordfdf {
      background: unset;
    }
    .guest-layout__side-content {
      width: 50%;
      background: #e3e6e6;
      padding: 3rem;
      display: flex;
      justify-content: center;
      flex-direction: column;
    }
    .guest-layout__dfdfdfdf {
      margin-top: 0;
    }
  `,
    cssWithVariants: `.baz {
        padding: 1.6rem 4.6rem;
        background: url('logo.svg') no-repeat;
      }
      
      .foo {
        position: relative;
        padding: 1.6rem 4.6rem;
        margin-bottom: 1.6rem;
        border: 1px solid #FAD0D0;
        color: #fff;
        border-radius: 0.2rem;
        width: 100%;
      } 
      
      .bar {
        position: relative;
        padding: 1.6rem 4.6rem;
      }
      
      .foo:hover {
        background: #cccccc;
      }
      
      .foo:focus {
        border-color: #e2f2f0;
      }
      
      @media (min-width: 1280px) {
        .bar {
          padding: 3rem 7rem;
          margin-bottom: 2.4rem;
        } 
      }
      
      .bar::placeholder {
        color: #e6e6e6;
      }
      `,
};
