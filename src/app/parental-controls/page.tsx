import Link from "next/link";

export default function ParentalControlsPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/age" className="text-gray-400 hover:text-white mb-6 inline-block">
        ← Back
      </Link>

      <h1 className="text-3xl font-bold mb-8">Parental Controls & Safety</h1>

      <div className="prose prose-invert max-w-none space-y-8 text-gray-300">
        <section>
          <p>
            Access to this platform is strictly limited to adults. By using this site, users confirm that they are at least eighteen (18) years of age (or the legal age of majority in their location), legally able to agree to our Terms of Service, and accessing the site from a jurisdiction where adult content is permitted.
          </p>
        </section>

        <section>
          <p>
            To help prevent access by minors, this platform is fully compliant with RTA (Restricted to Adults) standards. This allows parental control systems, filters, and content-blocking tools to automatically block our site when enabled.
          </p>
        </section>

        <section>
          <p>
            We strongly encourage parents and guardians to actively supervise their children&apos;s online activity and to make use of the wide range of parental control tools available on modern devices, operating systems, and internet services.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Built-In Parental Controls</h2>
          <p>
            All modern operating systems have built-in parental controls and they are simple to activate requiring only a few minutes to setup. Microsoft Windows 10 for instance, allows parents to easily setup accounts for their children, restrict which apps and programs they can open, and block inappropriate websites at the touch of a button.
          </p>
          <p className="mt-3">
            Visit the <a href="https://www.microsoft.com/en-us/microsoft-365/family-safety?ocid=family_signin" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:underline">Microsoft Family Safety site</a> for more information.
          </p>
          <p className="mt-3">
            Apple devices such as Macs, iPads, and iPhones have similar parental controls which can be enabled by following the instructions on Apple&apos;s dedicated <a href="https://www.apple.com/families/" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:underline">Families site</a>.
          </p>
          <p className="mt-3">
            iOS devices from Apple such as iPhones and iPads can block inappropriate content, set screen time limits and prevent apps from being installed without permission. More information is available on Apple&apos;s dedicated <a href="https://www.apple.com/families/" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:underline">Families site</a>.
          </p>
          <p className="mt-3">
            Android products such as smartphones and tablets contain similar protections, allowing parents to choose what their children can see and do on their personal devices. The <a href="https://safety.google/settings/parental-controls/" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:underline">Google Safety Centre</a> will walk you through the setup process.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Internet Provider Filters</h2>
          <p>
            Many Internet Service Providers (ISPs) offer free content-filtering options that can block adult websites across your home network. These can usually be activated through your ISP&apos;s account dashboard or customer support.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Third-Party Parental Control Apps</h2>
          <p>
            Beyond the free parental controls offered by operating systems, device manufacturers, and internet service providers, there are also numerous third-party parental control applications available. Below is a selection of popular options:
          </p>
          <ul className="list-disc list-inside mt-4 space-y-2">
            <li><a href="https://www.qustodio.com/en/" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:underline">Qustodio</a></li>
            <li><a href="https://www.kaspersky.co.uk/safe-kids" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:underline">Kaspersky Safe Kids</a></li>
            <li><a href="https://www.netnanny.com/" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:underline">Net Nanny</a></li>
            <li><a href="https://family.norton.com/web/" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:underline">Norton Family</a></li>
            <li><a href="https://www.mobicip.com/" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:underline">Mobicip</a></li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Our Commitment</h2>
          <p>
            We take the protection of minors seriously and support the use of parental controls and filtering tools to prevent underage access. Parents and guardians are encouraged to use these resources to ensure a safe and appropriate online environment for their children.
          </p>
        </section>
      </div>
    </main>
  );
}
